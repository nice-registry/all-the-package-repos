const dedent = require('dedent')

module.exports = {

  // Expression to replace
  regex: /<!-- stats -->[\s\S]+?<!-- \/stats -->/m,

  /**
   * @param {object} metadata
   * @return {string} markdown table
   */
  build: (metadata) => {
    const total = metadata.packages
    const repos = metadata.repos

    const areNull = repos.unsets || 0
    const notNull = total - areNull

    const perc = (val) => (val * 100 / total).toFixed(2)

    return dedent`
      <!-- stats -->
      Packages | Count | Percentage
      :------- | -----:| ----------:
      With repository | ${notNull} | ${perc(notNull)}%
      Null repository | ${areNull} | ${perc(areNull)}%
      **Total** | ${total} | ${perc(total)}%

      Providers | Count | Percentage
      :-------- | -----:| ----------:
      GitHub | ${repos.github} | ${perc(repos.github)}%
      GitLab | ${repos.gitlab} | ${perc(repos.gitlab)}%
      Bitbucket | ${repos.bitbucket} | ${perc(repos.bitbucket)}%
      Others | ${repos.others} | ${perc(repos.others)}%
      **Total** | ${notNull} | ${perc(notNull)}%
      <!-- /stats -->
      `
  }
}
