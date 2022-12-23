# all-the-package-repos

*Maintained by [jsDelivr](https://github.com/jsdelivr). Please consider [becoming a sponsor](https://github.com/sponsors/jsdelivr) to support us.*

All the repository URLs in the npm registry as an object whose keys are package names and values are URLs.

This package weighs in at about 100 MB.

## Stats

<!-- stats -->
Packages | Count | Percentage
:------- | -----:| ----------:
With repository | 1367129 | 62.51%
Null repository | 819780 | 37.49%
**Total** | 2186909 | 100.00%

Providers | Count | Percentage
:-------- | -----:| ----------:
GitHub | 1340044 | 61.28%
GitLab | 5100 | 0.23%
Bitbucket | 1332 | 0.06%
Others | 20653 | 0.94%
**Total** | 1367129 | 62.51%
<!-- /stats -->

## Installation

```sh
npm install all-the-package-repos --save
```

## Usage

```js
repos = require('all-the-package-repos')

repos.express
// https://github.com/expressjs/express
```

See [example.js](example.js) for more usage details.

GitHub URLs are normalized to their `https` form using
[github-url-to-object](http://ghub.io/github-url-to-object):

- `git@github.com:foo/bar.git` becomes `https://github.com/foo/bar`
- `foo/bar` becomes `https://github.com/foo/bar`
- [etc...](http://ghub.io/github-url-to-object)

### Repository Hostnames

For the curious, there's a submodule that collects all the hostnames of all the
repository URLS:

```js
require('./hostnames').slice(0,10)

[ 
  { value: 'github.com', count: 452768 },
  { value: 'bitbucket.org', count: 553 },
  { value: 'git.oschina.net', count: 219 },
  { value: 'gitlab.com', count: 116 },
  { value: 'git.coding.net', count: 114 },
  { value: 'archive.voodoowarez.com', count: 81 },
  { value: 'gitee.com', count: 60 },
  { value: 'gitlab.baidu.com', count: 49 },
  { value: 'git-wip-us.apache.org', count: 38 },
  { value: 'gitlab.alibaba-inc.com', count: 36 }
]
```

It also has a CLI:

```sh
all-the-package-repo-hostnames | head -n 10

github.com                                        452768
bitbucket.org                                     553
git.oschina.net                                   219
gitlab.com                                        116
git.coding.net                                    114
archive.voodoowarez.com                           81
gitee.com                                         60
gitlab.baidu.com                                  49
git-wip-us.apache.org                             38
gitlab.alibaba-inc.com                            36
```

## Tests

```sh
npm install
npm test
```

## Dependencies

None

## Dev Dependencies

- [all-the-packages](https://github.com/zeke/all-the-packages): All the npm registry metadata as an offline event stream.
- [github-url-to-object](https://github.com/zeke/github-url-to-object): Extract user, repo, and other interesting properties from GitHub URLs
- [object-values](https://github.com/sindresorhus/object-values): Get the values of an object
- [standard](https://github.com/feross/standard): JavaScript Standard Style
- [tap-spec](https://github.com/scottcorgan/tap-spec): Formatted TAP output like Mocha&#39;s spec reporter
- [tape](https://github.com/substack/tape): tap-producing test harness for node and browsers


## License

MIT

_Generated by [package-json-to-readme](https://github.com/zeke/package-json-to-readme)_
