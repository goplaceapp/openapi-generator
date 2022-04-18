FROM node:17.5.0-alpine3.14 AS BUILD
COPY . /openapi-generator
WORKDIR /openapi-generator/code
# Prepare special .npmrc
# we need this because this will copy all files into the node_modules rather than using hard and soft links.
# Because we need to copy the dependencies into the prepared lib.
RUN echo "package-import-method=copy" > /root/.npmrc
RUN npm i -g pnpm \
    && pnpm i \
    && pnpm circular-check \
    && pnpm eslint \
    && pnpm ts-checks \
    && pnpm ts-emit

FROM node:17.5.0-alpine3.14
RUN npm i -g pnpm
COPY --from=BUILD /openapi-generator/code/build /usr/lib/openapi-generator
COPY --from=BUILD /openapi-generator/code/node_modules /usr/lib/openapi-generator/node_modules
COPY --from=BUILD /openapi-generator/template.package.json /usr/lib/openapi-generator/package.json
COPY --from=BUILD /openapi-generator/template.openapi-generator.sh /usr/local/bin/openapi-generator
ENTRYPOINT ["openapi-generator"]
