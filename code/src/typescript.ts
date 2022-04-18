import fs from 'fs';
import path from 'path';
import { Comments } from './comments';
import type { Meta, Schema, PropSpec, Prop, Nesting } from './types';

const importFrom = (imports: string, source: string): string => `import { ${imports} } from '${source}';`;

// parse${name}
const index = (source: string, title: string, description: string, schemas: Schema[]) =>
    Comments.index(source, title, description) +
    `
${schemas
    .map(({ name, spec: { type } }) =>
        type === 'enum'
            ? `export { ${name} } from './${name}';`
            : `export type { ${name} } from './${name}';\nexport { parse${name} } from './${name}';`
    )
    .join('\n')}
`;

const stringifyPropertiesType = (properties: Prop[], extensions: string[]): string =>
    properties.length
        ? extensions.map((name) => name + ' & ').join('') +
          `{
    ${properties
        .map(
            ({ name, required, type, description }) =>
                `${Comments.property(description)}${name}${required ? '' : '?'}: ${serializePropSpec(type)};`
        )
        .join('\n')
        .replace(/\n(.+)/g, '\n    $1')}
}`
        : extensions.length === 1
        ? extensions[0]
        : '{}';

const serializePropSpec = (spec: PropSpec): string => {
    switch (spec.type) {
        case 'plain':
            if (spec.value === 'date-time') return 'Date';
            if (spec.value === 'date') return 'DateWithoutTime';
            if (spec.value === 'string') return 'string';
            if (spec.value === 'number' || spec.value === 'int64' || spec.value === 'int32') return 'number';
            if (spec.value === 'boolean') return 'boolean';
            break;
        case 'ref':
            return spec.value;
        case 'enum':
            return enumValues(spec.value);
        case 'array':
            return array(serializePropSpec(spec.value));
        case 'map':
            return map(serializePropSpec(spec.value));
        case 'object':
            return stringifyPropertiesType(spec.value, spec.extensions);
    }
    throw new Error('Could not serialize prop spec: ' + JSON.stringify(spec));
};

const getParsing = (fromJson: string, name: string, nesting?: Nesting): string => {
    if (!nesting) {
        const parserPrefix = name === 'Date' || name === 'DateWithoutTime' ? 'new ' : 'parse';
        return `${parserPrefix}${name}(${fromJson})`;
    }
    if (nesting === 'map') return `mapValues(${fromJson}, parse${name})`;
    if (nesting === 'array') return `${fromJson}.map(parse${name})`;
    throw new Error('Nesting strategy not implemented: ' + nesting);
};

const parser = (name: string, { tsRefs }: Meta, allEnumNames: string[]): [isIdentity: boolean, serialized: string] => {
    const exportConst = `export const parse${name} =`;
    const specialHandling = tsRefs
        .sort((a) => (a.isExtension ? -1 : 1))
        .map(({ name, attributeInfo, nesting, isExtension }) => {
            if (allEnumNames.includes(name)) return '';
            if (isExtension) return `...parse${name}(json),`;
            if (!attributeInfo) return '';
            const { required } = attributeInfo;
            const fromJson = 'json.' + attributeInfo.name;
            return `${attributeInfo.name}: ${required ? '' : fromJson + ' ? '}${getParsing(fromJson, name, nesting)}${
                required ? '' : ' : undefined'
            },`;
        })
        .filter(Boolean);
    if (!specialHandling.length) {
        return [true, `${exportConst} identity as Identity<${name}>;`];
    }
    return [
        false,
        `${exportConst} (json: any): ${name} => ({
    ...json,
    ${specialHandling.join('\n    ')}
});`,
    ];
};
const type = (name: string, def: string) => `export type ${name} = ${def};`;
const enumValues = (values: string[]) => `{
    ${values.map((value) => `${value} = '${value}',`).join('\n    ')}
}`;
const enumType = (name: string, values: string) => `export enum ${name} ${values}`;

const map = (type: string) => `{ [key: string]: ${type} }`;
const array = (type: string) => `Array<${type}>`;

const stringifyImport = (name: string, isEnum: boolean) =>
    importFrom(isEnum ? name : `${name}, parse${name}`, './' + name);
const stringifyImports = (refs: string[], allEnumNames: string[]) =>
    refs.map((name) => stringifyImport(name, allEnumNames.includes(name))).join('\n');

type RuntimeDep = 'mapValues' | 'DateWithoutTime' | 'identity' | 'Identity';
const getRuntimeDeps = ({ tsRefs }: Meta, isIdentityParser: boolean): RuntimeDep[] => {
    const result: RuntimeDep[] = [];
    if (tsRefs.some(({ name }) => name === 'DateWithoutTime')) result.push('DateWithoutTime');
    if (tsRefs.some(({ nesting }) => nesting === 'map')) result.push('mapValues');
    if (isIdentityParser) result.push('identity', 'Identity');
    return result;
};

const getDeps = ({ tsRefs }: Meta): string[] => {
    const deps = new Set(tsRefs.map(({ name }) => name));
    deps.delete('Date');
    deps.delete('DateWithoutTime');
    return [...deps];
};

const fileContent = (source: string, { name, meta, spec }: Schema, allEnumNames: string[]) => {
    const serialized = serializePropSpec(spec);
    const isEnum = spec.type === 'enum';
    const ownContent = isEnum ? enumType(name, serialized) : type(name, serialized);
    const [isIdentityParser, parserString] = isEnum ? [false, ''] : parser(name, meta, allEnumNames);
    const runtimeDeps = getRuntimeDeps(meta, isIdentityParser);
    const runtimeImports = runtimeDeps.length > 0 ? importFrom(runtimeDeps.join(', '), '../../runtime') : '';

    return (
        Comments.general(source) +
        `
${[runtimeImports, stringifyImports(getDeps(meta), allEnumNames)].filter(Boolean).join('\n')}

${ownContent}

${parserString}
`.trim() +
        '\n'
    );
};

const generate = (source: string, title: string, description: string, schemas: Schema[], modelsDir: string) => {
    const schemaNames = schemas.map(({ name }) => name);
    fs.readdirSync(modelsDir)
        .filter((fileName) => fileName !== 'index.ts' && !schemaNames.includes(fileName))
        .forEach((fileName) => fs.unlinkSync(path.join(modelsDir, fileName)));

    const allEnumNames = schemas.filter(({ spec: { type } }) => type === 'enum').map(({ name }) => name);

    schemas.forEach((schema) => {
        fs.writeFileSync(path.join(modelsDir, schema.name + '.ts'), fileContent(source, schema, allEnumNames));
    });

    fs.writeFileSync(path.join(modelsDir, 'index.ts'), index(source, title, description, schemas));
};

export const TypeScript = { generate };
