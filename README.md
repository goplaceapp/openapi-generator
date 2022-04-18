# Development

1. `$ cd openapi-generator/code`
2. `$ pnpm i`
3. Make changes
4. `$ pnpm ts-emit`
5. `$ pnpm -s generate -- -v -r ../../../../`
6. (optional) repeat from step 3

# Before pushing to CI

1. Test all made changes by checking the generated templates manually
2. Ensure the total execution time stays almost the same (but must be below 1 sec)
3. `$ pnpm circular-check && pnpm eslint && pnpm ts-checks`

# Usage example of the Docker Container

```shell
IMAGE_NAME=orchasystems/openapi-generator:latest
docker run -v ${PWD}:/local ${IMAGE_NAME} -- -r /local
```

# Generator options

- `-v` Verbose logging
- `-r <CONTENT_ROOT>` Allows to the content root
