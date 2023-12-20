# Development

1. `$ cd openapi-generator/code`
2. `$ npm i`
3. Make changes

# Usage example of the Docker Container

```shell
IMAGE_NAME=goplace/openapi-generator:latest
docker run -v ${PWD}:/local ${IMAGE_NAME} -- -r /local -f ./openapi/specs/openapi.yaml -o ./openapi
```

# Generator options

- `-v` Verbose logging
- `-r <CONTENT_ROOT>` Allows to the content root
- `-f` Allows to change the openapi YAML file path, default: `./openapi/specs/openapi.yaml`
- `-o` Allows to change output location, default: `./openapi`
