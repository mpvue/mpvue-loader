var Vue = require('vue')
var App = require('./ssr-style.vue')

module.exports = () => new Vue({
  render: h => h(App)
})
