// ext. libs
var fs = require('fs');
var https = require('https');
var esprima = require('esprima');
var markdown = require('markdown').markdown;
var Handlebars = require('handlebars');
var cheerio = require('cheerio');


module.exports = function(grunt) {

  // grunt task def.
  grunt.registerTask('documantix', 'Documents stuff.', function() {
    var done = this.async();

    var header = '';
    var footer = '';

    var config = grunt.config.get('documantix');
    var files = grunt.file.expand(config.src);

    var numberOfFiles = files.length;
    var numberOfParsedFiles = 0;

    // load header
    https.get('https://raw.github.com/' + config.options.header, function(headRes) {
      headRes.on('data', function(d) {
        header += d;
      });

      headRes.on('end', function () {


    https.get('https://raw.github.com/' + config.options.footer, function(footRes) {
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
            pc.html = (pc.annotations.method ? '<h2 class="method"> .' + pc.annotations.method + '</h2>' : '<h1 class="topic">' + pc.annotations.part + '</h1>') + pc.html

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
              });


              comment.html = $.html();
              content += comment.html;
            }
          });

              if (parsedComments && parsedComments[0]) {
                if (parsedComments[0].annotations.part && parsedComments[0].annotations.part.trim() !== '') {
                  grunt.file.write(config.options.target + '/' + parsedComments[0].annotations.part.toLowerCase() + '.html', Handlebars.compile(header)() + Handlebars.compile(content)() + Handlebars.compile(footer)());
                  grunt.log.ok('File generated: ' + config.options.target + '/' + parsedComments[0].annotations.part.toLowerCase() + '.html');
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
