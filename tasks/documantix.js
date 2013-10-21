// ext. libs
var fs = require('fs');
var https = require('https');
var esprima = require('esprima');
var markdown = require('markdown').markdown;
var Handlebars = require('handlebars');
var cheerio = require('cheerio');

module.exports = function(grunt) {

  // grunt task def.
  grunt.registerMultiTask('documantix', 'Documents stuff.', function() {
    var done = this.async();
    var header = '';
    var footer = '';

    var config = this.options();
    var files = this.files[0].src;

    var vars = config.vars;

    var numberOfFiles = files.length;
    var numberOfParsedFiles = 0;

    // load header
    https.get('https://raw.github.com/' + config.header, function(headRes) {
      headRes.on('data', function(d) {
        header += d;
      });

      headRes.on('end', function () {

    https.get('https://raw.github.com/' + config.footer, function(footRes) {
      footRes.on('data', function(d) {
        footer += d;
      });

      footRes.on('end', function () {
        files.forEach(function (file) {
          var comments = [];
          var parsedComments = [];
          var content = '';
          var contents = fs.readFileSync(file);

          // parse comments
          comments = esprima.parse(contents, {comment: true}).comments;

          comments.forEach(function (comment, idx) {
            if (comment.type !== 'Block') {
              return false;
            }

            var cv = comment.value.split('\n *');
            var pc = {annotations: {}, md: '', html: ''};

            cv.forEach(function (line) {
              if (line.trim() === '*') {
                return false;
              }

              if (line.trim().substr(0,1) === '@') {
                var p1 = line.trim().split('@');
                var p2 = [];
                p1.forEach(function (part) {
                  if (part !== '') {
                    p2.push(part);
                  }
                });

                var name = p2[0].substr(0, p2[0].indexOf(' '));
                var content = p2[0].substring(p2[0].indexOf(' ')).trim();

                if (!name) {
                  name = content;
                  content = true;
                }

                pc.annotations[name] =  content;
              } else {
                pc.md += line + '\n';
              }
            });

            pc.html = markdown.toHTML(pc.md);
            pc.html = (pc.annotations.method ? '<a class="nav-helper" data-name="meth-' + pc.annotations.method + '"></a><h2 class="method"> .' + pc.annotations.method + '</h2>' : '<h1 class="topic">' + pc.annotations.part + '</h1>') + pc.html;

            if (pc.annotations.api) {
              parsedComments.push(pc);
            }
          });

          parsedComments.forEach(function (comment) {
            if (comment.annotations.api) {

              // do that <code> replacing thingie
              var $ = cheerio.load(comment.html);
              var $cde = $('code');

              $cde.each(function (idx, el) {
                if ($(el).html().substr(0, 10) === 'javascript') {
                  var contents = $(el).html().substring(10);
                  var plum = $('<pre><code class="language-javascript">' + contents + '</code></pre>');
                  $('code').eq(idx).replaceWith(plum);
                }

                if ($(el).html().substr(0, 4) === 'html') {
                  var contents = $(el).html().substring(4);
                  var plum = $('<pre><code class="language-markup">' + contents + '</code></pre>');
                  $('code').eq(idx).replaceWith(plum);
                }

                if ($(el).html().substr(0, 3) === 'css') {
                  var contents = $(el).html().substring(3);
                  var plum = $('<pre><code class="language-css">' + contents + '</code></pre>');
                  $('code').eq(idx).replaceWith(plum);
                }

                if ($(el).html().substr(0, 4) === 'bash') {
                  var contents = $(el).html().substring(4);
                  var plum = $('<pre><code class="language-bash">' + contents + '</code></pre>');
                  $('code').eq(idx).replaceWith(plum);
                }
              });


              comment.html = $.html();
              content += comment.html;
            }
          });

          // add sidebar nav
          var sidenav = '';
          var hasNavElements = false;
          parsedComments.forEach(function (comment) {
            if (comment.annotations.api && comment.annotations.method) {
              hasNavElements = true;
              sidenav += '<li class="nav-meth-' + comment.annotations.method + '"><a href="#meth-' + comment.annotations.method + '">' + comment.annotations.method + '</a></li>'
            }
          });

          var oldContent = content;
          content = '<div class="grid__item one-whole">';

          if (hasNavElements) {
            content += '<div class="grid__item one-quarter sidenav" id="sidenav"><ul>' + Handlebars.compile(sidenav)(vars) + '</ul></div>';
            content += '<div class="grid__item three-quarters" id="content"><div class="grid__item one-whole" id="scroller">' + oldContent + '</div></div>';
          } else {
            content += '<div class="grid__item one-whole">' + oldContent + '</div>';
          }
          content += '</div>';
          vars.isNotSidebar = !hasNavElements;

              if (parsedComments && parsedComments[0]) {
                if (parsedComments[0].annotations.part && parsedComments[0].annotations.part.trim() !== '') {

                  grunt.file.write(config.target + '/' + parsedComments[0].annotations.part.toLowerCase() + '.html', Handlebars.compile(header)(vars) + Handlebars.compile(content)(vars) + Handlebars.compile(footer)(vars));
                  grunt.log.ok('File generated: ' + config.target + '/' + parsedComments[0].annotations.part.toLowerCase() + '.html');
                  numberOfParsedFiles++;
                } else {
                  numberOfParsedFiles++;
                }
              } else {
                numberOfParsedFiles++;
              }

              if (numberOfParsedFiles === numberOfFiles) {
                grunt.log.ok('All files generated');
                done();
              }

            });

          });
        });

      });
    });

  });
};
