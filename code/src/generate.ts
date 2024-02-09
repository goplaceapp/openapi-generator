import SwaggerParser from '@apidevtools/swagger-parser'
import fs from 'fs'
import {OpenAPIV3} from 'openapi-types'
import {Debug} from './debug.js'
import {Golang} from './golang.js'
import type {AttributeInfo, ExtraTag, Meta, Nesting, Prop, PropSpec, Request, Schema, YAMLSpec} from './types'

const getRefName = (ref: string): string => {
    const pathChunks = ref.split('/')
    return pathChunks[pathChunks.length - 1]
}

// name is only set for properties of objects
const getPropSpec = (meta: Meta, contentDesc: any, attributeInfo?: AttributeInfo, nesting?: Nesting): PropSpec => {
    if (contentDesc.allOf) {
        const properties = contentDesc.allOf
            .map((subContent: any) => (subContent.type === 'object' ? getProperties(meta, subContent) : []))
            .flat()

        const extensions = contentDesc.allOf
            .map((subContent: any) => (subContent.$ref ? getRefName(subContent.$ref) : undefined))
            .filter(Boolean) as string[]

        extensions.forEach((e) => meta.tsRefs.push({ name: e, isExtension: !attributeInfo, attributeInfo, nesting }))

        return { type: 'object', value: properties, extensions }
    }
    if (contentDesc.type === 'string') {
        if (contentDesc.enum) return { type: 'enum', value: contentDesc.enum }
        if (contentDesc.format === 'date-time') {
            meta.goRefs.add('time')
            meta.tsRefs.push({ name: 'Date', attributeInfo, nesting })
            return { type: 'plain', value: 'date-time' }
        }
        if (contentDesc.format === 'date') {
            meta.tsRefs.push({ name: 'DateWithoutTime', attributeInfo, nesting })
            return { type: 'plain', value: 'date' }
        }
        return { type: 'plain', value: 'string' }
    }
    if (contentDesc.type === 'number' || contentDesc.type === 'boolean')
        return { type: 'plain', value: contentDesc.type }
    if (contentDesc.type === 'integer') return { type: 'plain', value: contentDesc.format || 'int64' }
    if (contentDesc.$ref) {
        const refName = getRefName(contentDesc.$ref)
        meta.tsRefs.push({ name: refName, attributeInfo, nesting })
        return { type: 'ref', value: refName }
    }
    if (contentDesc.allOf && contentDesc.allOf.length === 1) {
        const subContent = contentDesc.allOf[0]
        if (subContent.$ref) {
            const refName = getRefName(subContent.$ref)
            meta.tsRefs.push({ name: refName, attributeInfo, nesting })
            return { type: 'ref', value: refName }
        }
    }
    if (contentDesc.items) {
        // --> contentDesc.type === 'array' check seems to be not sufficient
        return { type: 'array', value: getPropSpec(meta, contentDesc.items, attributeInfo, 'array') }
    }
    if (contentDesc.additionalProperties) {
        return { type: 'map', value: getPropSpec(meta, contentDesc.additionalProperties, attributeInfo, 'map') }
    }
    if (contentDesc.properties || contentDesc.type === 'object') {
        // TODO(HY): Fix the one model with empty schema, i.e. type: 'object' but no 'properties'
        return { type: 'object', value: getProperties(meta, contentDesc), extensions: [] }
    }

    global.console.error(`Unsupported property on schema "${meta.name}": \n\n${JSON.stringify(contentDesc, null, 2)}`)
    process.exit(1)
}

const getProperties = (meta: Meta, schema: any): Prop[] =>
    Object.entries(schema.properties || {}).map(([name, desc]: [string, any]) => {
        const required = !!schema.required?.includes(name)
        return {
            name,
            required,
            description: desc.description,
            // We need the nullable attribute in addition to the required flag. One example:
            // Someone updates a project. By not-setting the "name" and by setting the "name" to an empty string, we
            // want to achieve different things. Not-setting means, that no update on the "name" should be done, whereas
            // updating the "name" with an empty string means deleting the current name. For the backend we use therefore
            // the type "*string" where nil means not set.
            nullable: desc.nullable,
            type: getPropSpec(meta, desc, { name, required }),
            extraTags: getExtraTags(desc),
        }
    })

const getExtraTags = (desc: any): ExtraTag[] => {
    let extraTags: ExtraTag[] = [];

    if (Object.prototype.hasOwnProperty.call(desc, 'x-extra-tags')) {
        extraTags = Object.entries(desc['x-extra-tags'] || {}).map(([key, value]: [string, any]) => ({key, value}));
    }

    if (Object.prototype.hasOwnProperty.call(desc, 'x-permissions')) {
        extraTags.push({key: 'x-permissions', value: desc['x-permissions']});
    }

    return extraTags;
}

const parseSchema = (name: string, schema: any): Schema => {
    const meta = { tsRefs: [], goRefs: new Set<string>(), name }
    const spec = getPropSpec(meta, schema)
    return { name, meta, spec }
}

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
}

const SwaggerOptions = { validate: { spec: false } }

export const generate = async (name: string, { openapiPath, goGenerateTarget }: YAMLSpec) => {
    ensureDir(goGenerateTarget.models)

    const yamlParsed = name + '-> YAML parsed'
    const schemasAndRequestsParsed = name + '-> Schemas and requests parsed'
    const backendTemplatesGenerated = name + '-> Backend templates generated'

    Debug.time(yamlParsed)
    const parser = new SwaggerParser()
    await SwaggerParser.validate(openapiPath, SwaggerOptions)
    await parser.parse(openapiPath, SwaggerOptions)
    Debug.timeEnd(yamlParsed)

    Debug.time(schemasAndRequestsParsed)
    const parsedSchemas = Object.entries((parser.api as OpenAPIV3.Document).components!.schemas!).map(
        ([name, schema]) => parseSchema(name, schema)
    )

    const requests = Object.entries(parser.api.paths || {})
        .map(([path, requests]: [string, any]) => {
            return Object.entries(requests).map(([requestType, request]: [string, any]) => {
            const parsedPath = path.replace(/{([^}]+)}/g, ':$1')
                const extraTags = getExtraTags(request);
                const permissions = extraTags.find(tag => tag.key === 'x-permissions')?.value || [];
                return {
                    path: parsedPath,
                    requestType,
                    description: request.summary,
                    name: request.operationId,
                    category: request.tags?.[0] || 'index',
                    permissions,

                }
            })
        })
        .flat()
        .sort((a, b) => 2 * a.category.localeCompare(b.category) + a.name.localeCompare(b.name)) as Request[]
    Debug.timeEnd(schemasAndRequestsParsed)

    Debug.log(`${name}-> schemas.count: ${parsedSchemas.length}, requests.count: ${requests.length}`)

    Debug.time(backendTemplatesGenerated)
    Golang.generate(
        openapiPath,
        parser.api.info.title,
        parser.api.info.description || '',
        parsedSchemas,
        requests,
        goGenerateTarget
    )
    Debug.timeEnd(backendTemplatesGenerated)
}
