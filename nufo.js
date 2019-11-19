var md = require( 'markdown' ).markdown;
var fs = require('fs');
var art = require('ascii-art');
art.Font.fontPath = __dirname+'/Fonts/'
var asynk = require('async');
var concat = require('concat-stream');
var hash = require('object-hash');
var request = require('request');

var spaces = function(num){
    return new Array(num).map(function(){ return ' ' }).join('');
}

var parentDir = function(file){
    var parts = file.split('/');
    parts.pop();
    return parts.join('/')
}

var transferProxy = function(file, options, callback){
    var cacheName = hash(file);
    var type = file.split('.').pop();
    if(!options.cacheDir) throw new Error('cacheDir is required');
    var localFile = options.cacheDir+cacheName+'.'+type;
    fs.stat(localFile, function(err){
        if(err){
            request({
                uri: file
            }).pipe(fs.createWriteStream(localFile)).on('close', function(){
                setTimeout(function(){
                    callback(undefined, localFile);
                });
            });
        }else callback(undefined, localFile);
    });
}

var handleNFOTableScan = function(str){
    return str;
    if(str.indexOf("\n") !== -1 && str.indexOf("\n") !== -1){
        var lines = str.split("\n");
        var colsPerline = lines.map(function(line){
            var count = 0;
            line.split('').forEach(function(chr){
                if(chr === '|') count++;
            });
            return count;
        });
        var isATable = colsPerline.filter(function(lineCount){
            return lineCount > 1;
        }).length > 1;
        var data = lines.map(function(line){
            var res = line.split('|');
            res.shift();
            res.pop();
            return res;
        });
        data.filter(function(fields){
            return fields[0] && (
                (fields[0].length === 1 && fields[0] === '-') ||
                (fields[0].length === 2 && fields[0] === '--') ||
                (fields[0].indexOf('---') !== -1)
            );
        });
        return str;
    } else return str;
}

var scopeStack = [];
var parentScope = function(){ return scopeStack[scopeStack.length-2] };
var thisScope = function(){ return scopeStack[scopeStack.length-1] };

var tagStacks = {};
var stack = function(type){
    if(!tagStacks[type]) tagStacks[type] = [];
    return tagStacks[type];
}
var tag = function(type, value){
    if(!tagStacks[type]) tagStacks[type] = [];
    if(value) tagStacks[type].push(value);
    return tagStacks[type][tagStacks[type].length - 1];
}

var processList = function(node, options, callback){
    var nodeList = Array.prototype.slice.call(node);
    nodeList.shift(); //drop 'markdown';
    var currentContainer = [];
    tag(node[0], currentContainer);
    asynk.eachOfSeries(nodeList, function(node, index, done){
        processNFOScope(node, options, function(err, thisResult){
            if(err) throw err;
            currentContainer.push(thisResult);
            done();
        })
    }, function(){
        stack(node[0]).pop();
        var results = currentContainer;
        callback(undefined, results);
    });
}

var processListWithStrings = function(node, options, callback){
    var nodeList = Array.prototype.slice.call(node);
    nodeList.shift(); //drop 'markdown';
    var currentContainer = [];
    tag(node[0], currentContainer);
    asynk.eachOfSeries(nodeList, function(node, index, done){
        if(typeof node === 'string'){
            currentContainer.push(handleNFOTableScan(node));
            done();
        }else processNFOScope(node, options, function(err, thisResult){
            if(err) throw err;
            currentContainer.push(thisResult);
            done();
        })
    }, function(){
        stack(node[0]).pop();
        var results = currentContainer;
        callback(undefined, results);
    });
}

var processItem = function(node, options, callback){
    var nodeList = Array.prototype.slice.call(node);
    nodeList.shift(); //drop 'markdown';
    var currentContainer = [];
    tag(node[0], currentContainer);
    callback(undefined, node, options);
    stack(node[0]).pop();
}

var processNFOScope = function(node, options, callback){
    if(typeof node[0] === 'undefined') return callback();
    scopeStack.push(node);
    switch(node[0]){
        case 'markdown':
            processList(node, options, function(err, results){
                callback(undefined, results.join("\n"));
            });
            break;
        case 'header':
            var font;
            switch(node[1].level){
                case 1 : font = 'cyberlarge'; break;
                case 2 : font = 'cybermedium'; break;
                case 3 : font = 'cybersmall'; break;
            }
            if(font){
                return art.font(node[2], font, function(err, result){
                    return callback(undefined, result);
                });
            }else{
                return callback(undefined, node[2]);
            }
        case 'bulletlist':
            processList(node, options, function(err, results){
                var indent = spaces(stack(node[0]).length+1 * (options.indent || 2));
                var result = results.map(function(item){
                    return indent + ((options.disc || '•')+' ') + item;
                }).join("\n");
                return callback(undefined, result);
            });
            break;
        case 'listitem':
            processListWithStrings(node, options, function(err, results){
                return callback(undefined, results.join(''));
            });
            break;
        case 'para':
            processListWithStrings(node, options, function(err, results){
                return callback(undefined, results.join('')+"\n");
            });
            break;
        case 'table':
            processList(node, options, function(err, results){
                var thead = results[0];
                var tbody = results[1];
                var columns = thead[0].map(function(header){
                    return {
                        value : header,
                        style : (options.tableStyle || 'white')
                    }
                });
                art.table({
                    width : 80,
                    data : tbody,
                    headerStyle : 'yellow',
                    bars : 'double',
                    dataStyle : 'bright_white',
                    borderColor : 'gray',
                    columns : columns
                }, function(rendered){
                    // use rendered text
                    callback(undefined, rendered+"\n");
                });
            });
            break;
        case 'thead':
            processList(node, options, function(err, results){
                callback(undefined, results);
            });
            break;
        case 'tbody':
            processList(node, options, function(err, results){
                callback(undefined, results);
            });
            break;
        case 'tr':
            processList(node, options, function(err, results){
                callback(undefined, results);
            });
            break;
        case 'th':
        case 'td':
            processListWithStrings(node, options, function(err, results){
                callback(undefined, results.filter(function(item, index){
                    if(index === 0 && item === undefined) return false;
                    return true;
                }).join(''));
            });
            break;
        case 'inlinecode':
            return callback(undefined, art.style(
                node[1],
                options.codeStyle || 'gray')+'\033[0m');
        case 'strong':
            return callback(undefined, art.style(
                node[1],
                options.boldStyle || 'bold')+'\033[0m');
        case 'em':
            return callback(undefined, art.style(
                node[1],
                options.boldStyle || 'italic')+'\033[0m');
        case 'img':
            if(node[1].href.indexOf('://') !== -1){
                //we have a protocol, handle it
                transferProxy(node[1].href, options, function(err, localFile){
                    var image = new art.Image({
                        filepath: localFile,
                        width: 80
                    });
                    image.write(function(err, ascii){
                        callback(undefined, ascii+'\033[0m');
                    });
                });
                //callback(undefined, '[PROTO: '+node[1].href+']');
                break;
            }
            var image = new art.Image({
                filepath: options.fileroot+node[1].href,
                width: 80
            });
            image.write(function(err, ascii){
                callback(undefined, ascii+'\033[0m');
            });
            break;
        case 'code_block':
            return callback(undefined, art.style(
                node[1],
                options.codeStyle || 'gray')+'\033[0m'+"\n");
        case 'link':
            //todo: mark against a hit map
            return callback(undefined, art.style(
                node[2],
                options.linkStyle || 'blue')+'\033[0m');
        default : {
            return callback(undefined, '[???:'+node[0]+']');
        }
    }
}

var Transformations = {
    nfo : function(tree, options, cb){
        return processNFOScope(tree, options, function(err, result){
            cb(err, result);
        });
    }
};

var ready = function(context, callback){
    if(context.ready) return callback();
    else context.jobs.push(callback)
}
var done = function(context){
    var work = context.jobs;
    context.jobs = [];
    work.forEach(function(job){
        job();
    })
}

var Transformation = function(options){
    this.options = options || {};
    this.jobs = [];
    var ob = this;
    if(this.options.file){
        this.options.fileroot = parentDir(this.options.file)+'/';
        var stream = fs.createReadStream(this.options.file);
        this.load(stream, function(err){
            if(!err) done(ob);
        });
    }
}

Transformation.prototype.load = function(stream, callback){
    var ob = this;
    stream.pipe(concat(function(buf){
        var tree = md.parse( buf.toString(), 'Maruku' );
        ob.tree = tree;
        callback(undefined, tree);
    }));
    stream.on('error', function(err){
        callback(err);
    });
}

Transformation.prototype.transform = function(type, callback){
    var trns = type.toLowerCase();
    if(!Transformations[trns]) return callback(new Error('Unknown transformation: '+trns))
    var ob = this;
    ready(this, function(){
        Transformations[trns](ob.tree, ob.options, function(err, result){
            callback(err, result);
        });
    });
}
module.exports = Transformation;
