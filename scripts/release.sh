#!/usr/bin/env bash

set -x            # print commands before execution
set -o errexit    # always exit on error
set -o pipefail   # honor exit codes when piping
set -o nounset    # fail on unset variables

[ -z "$npm_package_repository_url" ] && echo "usage: npm run release" && exit 1;

git clone $npm_package_repository_url pkg
cd pkg
npm run build
npm test
[[ `git status --porcelain` ]] || exit
git add .
git config user.email $npm_package_author_email
git config user.name $npm_package_author_name
git commit -am "update $npm_package_name"
npm version minor -m "bump minor to %s"
git push origin master --follow-tags
npm publish