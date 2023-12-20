import path from 'path'
import { Debug } from './debug'
import { generate } from './generate'
import type { GoGenerateTarget, YAMLSpec } from './types'

process.on('unhandledRejection', (err: any) => {
    console.error(err.stack)
    process.exit(1)
})

process.argv.includes('-v') && Debug.init()
const indexRootParam = process.argv.indexOf('-r')
if (indexRootParam >= 0) {
    process.chdir(process.argv[indexRootParam + 1])
}

const indexFileParam = process.argv.indexOf('-f')
const indexOutputLocationParam = process.argv.indexOf('-o')

const getGoGenerateTarget = (base: string, withRouters?: boolean, ignoredFiles: string[] = []): GoGenerateTarget => ({
    base: path.normalize(base),
    models: path.normalize(base + '/go'),
    withRouters,
    ignoredFiles,
})

const AllYAMLs: { [name: string]: YAMLSpec } = {
    GATEWAY: {
        openapiPath:
            indexFileParam >= 0
                ? path.normalize(process.argv[indexFileParam + 1])
                : path.normalize('./services/gateway/openapi/specs/openapi.yaml'),
        goGenerateTarget:
            indexOutputLocationParam >= 0
                ? getGoGenerateTarget(process.argv[indexOutputLocationParam + 1], true)
                : getGoGenerateTarget('./services/gateway/openapi', true),
    },
}

const totalTime = 'Total time'
Debug.time(totalTime)
for (const [name, spec] of Object.entries(AllYAMLs)) {
    await generate(name, spec)
}
Debug.timeEnd(totalTime)
