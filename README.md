NuFO
====
[![NPM version](https://img.shields.io/npm/v/nufo.svg)]()
[![npm](https://img.shields.io/npm/dt/nufo.svg)]()

Use Markdown to render [NFO](https://en.wikipedia.org/wiki/.nfo) files, allowing you to both read rendered markdown in the terminal and to generate NFO files.

(Pronounced "New Eff Oh")

Install
-------

`npm install -g nufo`

Config
-----

Configuration is stored in `~/.NuFO/config.json` and by default images are cached in `~/.NuFO/`

Usage
-----

`nufo <markdown file>`

Programmatic Usage
------------------

```js
    var nufo = new NuFO({
        //the target markdown file
        file : '<filepath>',
        //for caching images fetched by URL
        cacheDir : '<cache directory>'
    });
    nufo.transform('NFO', function(err, result){
        if(err) throw err;
        // do something with 'result'
    });
```

Todo
-----
- support HTML
- support Windows

Enjoy!

- Abbey Hawk Sparrow
