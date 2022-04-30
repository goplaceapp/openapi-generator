build:
	docker build --rm --no-cache -t orchasystems/openapi-generator:latest .
	docker build --rm --no-cache -t orchasystems/openapi-generator:v0.1.1-node17.5.0-alpine3.14 .

push:
	docker push orchasystems/openapi-generator:latest
	docker push orchasystems/openapi-generator:v0.1.1-node17.5.0-alpine3.14
