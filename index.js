"use strict"

module.exports = process.env.COVERAGE ? require('./lib-cov/restify-util') : require('./lib/restify-util')