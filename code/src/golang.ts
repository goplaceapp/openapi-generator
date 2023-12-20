import fs from 'fs'
import path from 'path'
import { Comments } from './comments'
import type { ExtraTag, GoGenerateTarget, Meta, Prop, PropSpec, Request, Schema } from './types'

// TODO: Calculate the "/v1"
const basePath = '/v1'

const _indentNewLines = (s: string, tabs = 1) => s.replace(/\n(.+)/g, `\n${'\t'.repeat(tabs)}$1`)

const routers = (source: string, title: string, description: string, requests: Request[]) =>
    Comments.index(source, title, description) +
    `
package openapi

import (
\t"context"
\t"github.com/gin-gonic/gin"
\t"net/http"
)

// ContextHandler the handler type that allows access to the current go and gin context
type ContextHandler func(ctx context.Context, c *gin.Context)

// Route is the information for every URI.
type Route struct {
\t// Name is the name of this Route.
\tName string
\t// Method is the string for the HTTP method. ex) GET, POST etc..
\tMethod string
\t// Pattern is the pattern of the URI.
\tPattern string
\t// HandlerFunc is the handler function of this route.
\tHandlerFunc ContextHandler
}

const (
\t${_indentNewLines(
        requests
            .map(
                ({ path, name }) => `// ${name}Endpoint the path of the ${name} endpoint
${name}Endpoint = "${basePath + path}"`
            )
            .join('\n\n')
    )}
)

// Routes is the list of the generated Route.
type Routes []Route

// CreateRoutes creates the routes of the given router
func CreateRoutes(router Router) Routes {
    return Routes{
\t\t${_indentNewLines(
        requests
            .map(
                ({ requestType, name }) => `{
\tName:        "${name}",
\tMethod:      http.Method${requestType},
\tPattern:     ${name}Endpoint,
\tHandlerFunc: router.${name}(),
},`
            )
            .join('\n'),
        2
    )}
    }
}

// Router the router that defines the gateway
type Router interface {
\t${_indentNewLines(
        requests
            .map(
                ({ description, name }) => `// ${name}${description ? ' ' + description.replace(/\n/g, ' ').trim() : ''}
${name}() ContextHandler`
            )
            .join('\n\n')
    )}
}
`

const _capitalize = (s: any): string => {
    if (typeof s !== 'string') return ''
    return s.charAt(0).toUpperCase() + s.slice(1)
}

const stringifyPropertiesType = (properties: Prop[], extensions: string[]): string =>
    properties.length
        ? `{${extensions.length ? _indentNewLines('\n' + extensions.join('\n\n') + '\n') : ''}
\t${_indentNewLines(
              properties
                  .map(
                      ({ name, required, nullable, type, description, extraTags }) =>
                          `${Comments.property(description)}${_capitalize(name)} ${
                              nullable ? '*' : ''
                          }${serializePropSpec(type)} \`json:"${name}${required ? '' : ',omitempty'}"${
                              serializeExtraTags(extraTags) !== '' ? ' ' + serializeExtraTags(extraTags) : ''
                          }\``
                  )
                  .join('\n\n')
          )}
}`
        : extensions.length === 1
        ? extensions[0]
        : '{}'

const serializeExtraTags = (extraTags: ExtraTag[]): string =>
    extraTags.map(({ key, value }) => `${key}:"${value}"`).join(' ')

const serializePropSpec = (spec: PropSpec): string => {
    switch (spec.type) {
        case 'plain':
            if (spec.value === 'string' || spec.value === 'int64' || spec.value === 'int32') return spec.value
            if (spec.value === 'date-time') return 'time.Time'
            if (spec.value === 'date') return 'string'
            if (spec.value === 'number') return 'float32'
            if (spec.value === 'boolean') return 'bool'
            break
        case 'ref':
            return spec.value
        case 'enum':
            // TODO(HY): This type is currently broken
            return spec.value as any
        case 'array':
            return array(serializePropSpec(spec.value))
        case 'map':
            return map(serializePropSpec(spec.value))
        case 'object':
            return stringifyPropertiesType(spec.value, spec.extensions)
    }
    throw new Error('Could not serialize prop spec: ' + JSON.stringify(spec))
}

const type = (name: string, def: string) => `type ${name} = ${def}`
const structType = (name: string, def: string) => `type ${name} struct ${def}`
const enumType = (name: string, values: string[]) => `type ${name} string

// List of ${name}
const (
\t${_indentNewLines(values.map((value) => `${name}_${value} ${name} = "${value}"`).join('\n\n'))}
)`

const map = (type: string) => `map[string]${type}`
const array = (type: string) => `[]${type}`

const stringifyImports = (refs: Meta['goRefs']) =>
    refs.size > 0
        ? `import (
\t${_indentNewLines([...refs].map((name) => `"${name}"`).join('\n'))}
)`
        : ''

const fileContent = (source: string, { name, meta, spec }: Schema) => {
    const serialized = serializePropSpec(spec)
    const ownContent =
        spec.type === 'enum'
            ? enumType(name, serialized as any) // TODO(HY): This type is currently broken
            : spec.type === 'object'
            ? structType(name, serialized)
            : type(name, serialized)

    return (
        Comments.general(source) +
        'package openapi\n\n' +
        `
${stringifyImports(meta.goRefs)}

${ownContent}
`.trim() +
        '\n'
    )
}

const generate = (
    source: string,
    title: string,
    description: string,
    schemas: Schema[],
    requests: Request[],
    { models, withRouters, ignoredFiles }: GoGenerateTarget
) => {
    const schemaNames = schemas.map(({ name }) => name)
    const dontDeleteFileNames = schemaNames.concat(ignoredFiles).concat(withRouters ? 'routers.go' : [])
    fs.readdirSync(models)
        .filter((fileName) => !dontDeleteFileNames.includes(fileName))
        .forEach((fileName) => fs.unlinkSync(path.join(models, fileName)))

    schemas.forEach((schema) => {
        fs.writeFileSync(path.join(models, schema.name + '.go'), fileContent(source, schema))
    })

    if (withRouters) {
        requests.unshift({ path: '/', requestType: 'get', name: 'index', category: 'index' })
        const r = requests.map(
            (parsedPath): Request => ({
                ...parsedPath,
                name: _capitalize(parsedPath.name),
                requestType: _capitalize(parsedPath.requestType) as Request['requestType'], // TODO(HY): This type is currently broken
            })
        )
        fs.writeFileSync(path.join(models, 'routers.go'), routers(source, title, description, r))
    }
}

export const Golang = { generate }
