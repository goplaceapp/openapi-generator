build:
	docker build --rm --no-cache -t goplace/openapi-generator:latest .
	docker build --rm --no-cache -t goplace/openapi-generator:v0.0.3-node21.4.0-alpine3.19 .

push:
	docker push goplace/openapi-generator:latest
	docker push goplace/openapi-generator:v0.0.3-node21.4.0-alpine3.19
