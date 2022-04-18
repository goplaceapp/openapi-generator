import path from 'path';
import type { GoGenerateTarget, YAMLSpec } from './types';
import { generate } from './generate';
import { Debug } from './debug';

process.on('unhandledRejection', (err: any) => {
    console.error(err.stack);
    process.exit(1);
});

process.argv.includes('-v') && Debug.init();
const indexRootParam = process.argv.indexOf('-r');
if (indexRootParam >= 0) {
    process.chdir(process.argv[indexRootParam + 1]);
}

const getGoGenerateTarget = (base: string, withRouters?: boolean, ignoredFiles: string[] = []): GoGenerateTarget => ({
    base: path.normalize(base),
    models: path.normalize(base + '/go'),
    withRouters,
    ignoredFiles,
});

const AllYAMLs: { [name: string]: YAMLSpec } = {
    GATEWAY: {
        openapiPath: path.normalize('./services/gateway/openapi/api/openapi.yaml'),
        goGenerateTarget: getGoGenerateTarget('./services/gateway/openapi', true),
    },
};

const totalTime = 'Total time';
Debug.time(totalTime);
for (const [name, spec] of Object.entries(AllYAMLs)) {
    await generate(name, spec);
}
Debug.timeEnd(totalTime);
