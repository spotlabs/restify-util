"use strict"

var restify = require('restify')
var _ = require('lodash')
var fs = require('fs')
var path = require('path')
var Promise = require('bluebird')

var validators ={
    length:{
        equals: function( length){
            return function(value,property){
                if (value.length !== length) {
                    throw new restify.InvalidArgument(property + ' must have length of ' + length)
                }
            }
        }
    },
    in: function(options){
        return function(value,property){
            if (!_.contains(options,value)){
                throw new restify.InvalidArgument(property + ' must be one of '+options)
            }
        }
    },
    is: {
        number: function(value,property){
            if (isNaN(value)) {
                throw new restify.InvalidArgumet(property + ' must be a number')
            }
            this[property] = Number(value)
        }
    },
    required: function(value,property){
        if (value === undefined){
            throw new restify.InvalidArgument(property + ' is required')
        }
    }
}

var verbs =
    [
        'del',
        'get',
        'head',
        'opts',
        'post',
        'put',
        'patch'
    ]

function setupRoute(options,server,route){
    if (route.hasOwnProperty('params')){
        var parts = options.path.split('/');
        Object.keys(route.params).forEach(function(param){
            if (_.contains(parts,param)){
                var index = parts.indexOf(param)
                if (index !== -1){
                    parts[index] = ':'+param
                }
            }
        })
        options.path = parts.join('/')
    }
    verbs.forEach(function(verb){
        if (route.hasOwnProperty(verb)){
            server[verb](options,function(req,res,next){
                try {
                    if (route.hasOwnProperty('params')) {
                        Object.keys(route.params).forEach(function (param) {
                            if (_.isArray(route.params[param])){
                                route.params[param].foreach(function(validator){
                                    route.params[param][validator].call(req.params,req.params[param],param)
                                })
                            }else{
                                route.params[param].call(req.params,req.params[param], param)
                            }
                        })
                    }
                }catch(err){
                    return next(err)
                }
                Promise.resolve(route[verb](req,res)).then(function(result){
                    res.send(result)
                    return next()
                }).catch(function(err){
                    return next(err)
                })
            })
        }
    })
}

function route(options,server,controllers,directory){
    var index = path.resolve(directory,'index.js')
    if (fs.existsSync(index)) {
        var thisRoute = require(directory)(controllers, validators)
        setupRoute(options, server, thisRoute)
    }
    fs.readdirSync(directory).forEach(function(value){
        var resolved = path.resolve(directory,value)
        var stat = fs.statSync(resolved)
        if (stat.isDirectory()){
            route(_.defaults({path: options.path+'/'+value},options),server,controllers,resolved)
        }
    })
}

module.exports = {
    validators: validators,
    route: function(server,controllers,directory){
        if (fs.exists(path.resolve(directory,'index.js'))){
            setupRoute({path: '/'},server,require(directory)(controllers,validators))
        }
        fs.readdirSync(directory).forEach(function(value){
            var resolved = path.resolve(directory,value)
            var stat = fs.statSync(resolved)
            if (stat.isDirectory()){
                //Is the first level a version number
                if (!isNaN(value)){
                    route({path: '/', version:value},server,controllers,resolved)
                }else{
                    route({path: '/'+value},server,controllers,resolved)
                }
            }
        })
    }
}
