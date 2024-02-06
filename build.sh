#! /bin/sh

# exit if a command fails
set -xe

LC_ALL=en_US.UTF-8
LANG=en_US.UTF-8
LANGUAGE=en_US.UTF-8

pnpm i
pnpm ts-checks
pnpm ts-emit

mv build /usr/lib/openapi-generator
mv node_modules /usr/lib/openapi-generator/node_modules
