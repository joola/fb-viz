var
  fs = require('fs'),
  path = require('path'),
  request = require('request'),
  async = require('async'),
  elastic = require('elasticsearch'),
  Debug = require('console-debug');

var console = new Debug({
  uncaughtExceptionCatch: false,
  consoleFilter: [],
  logToFile: false,
  logFilter: ['LOG', 'DEBUG', 'INFO'],
  colors: true
});

var all = [];
var token = "CAACEdEose0cBAC121mD2UYyxpe8wgumK8nHdbu08rHert9EZCmwRcMmYNWElXdYdHWBYp5FBlbz8gPRPbjlXZCFHQ4v3yDmyOAEyXbgEDGNr6dasCZCAAkMrcJ6pbDmIuGw9CD5OXBQ7Y7ZBFYImuPDISThq5SSn3MxAsBmkT8Hpzyrwln4f0BKIZBJZBdebfUTZBmTR9ChwZBZBjwN3hq4gZA";

var posts = [];
var comments = [];

var users = {};


function _request(options, callback) {
  console.debug('Fetching url: ' + options.url);
  request.get(options, callback);
}

function getData(url, callback) {
  async.waterfall([
    function (callback) {
      request.get({
        url: url,
        method: "GET"
      }, function (err, head, body) {
        var json;
        try {
          json = JSON.parse(body);
        }
        catch (x) {
          console.log('JSON PARSE ERROR', body, url);
          console.log(x);
        }

        if (json.data && json.data.length > 0) {
          json.data.forEach(function (d) {
            if (d.type === 'status')
              d.link = d.actions[0].link;

            var p = {
              id: d.id,
              op_id: d.from.id,
              op: d.from.name,
              group: d.to.data[0].name,
              title: d.message,
              link: d.link,
              post_type: d.type,
              create_time: d.created_time,
              updated_time: d.updated_time
            };

            users[p.op_id] = users[p.op_id] || {
              id: d.from.id,
              name: d.from.name,
              posts: 0,
              likes_given: 0,
              likes_received: 0,
              comments_given: 0,
              comments_received: 0,
              activity: []
            };
            users[p.op_id].posts += 1;
            users[p.op_id].activity.push({time: p.create_time, activity: 'post', resource_id: p.id});

            p.likes_count = 0;
            if (d.likes) {
              p.likes_count = d.likes.data.length;
              d.likes.data.forEach(function (like) {
                like.post = d.id;

                users[like.id] = users[like.id] || {
                  id: like.id,
                  name: like.name,
                  posts: 0,
                  likes_given: 0,
                  likes_received: 0,
                  comments_given: 0,
                  comments_received: 0,
                  activity: []
                };
                users[like.id].likes_given += 1;
                users[like.id].activity.push({time: p.create_time, activity: 'like', resource_id: p.id});
              });
              if (d.likes.paging.next)
                p.likes_next = d.likes.paging.next;
            }

            users[p.op_id].likes_received += p.likes_count;

            p.comments_count = 0;
            if (d.comments) {
              p.comments_count = d.comments.data.length;
              d.comments.data.forEach(function (comment) {
                comment.post = d.id;
                comments.push(comment);

                users[comment.from.id] = users[comment.from.id] || {
                  id: comment.from.id,
                  name: comment.from.name,
                  posts: 0,
                  likes_given: 0,
                  likes_received: 0,
                  comments_given: 0,
                  comments_received: 0,
                  activity: []
                };
                users[comment.from.id].comments_given += 1;
                users[comment.from.id].likes_received += comment.like_count;
                users[comment.from.id].activity.push({time: comment.created_time, activity: 'comment', resource_id: p.id});
              });
              if (d.comments.paging.next)
                p.comments_next = d.comments.paging.next;
            }
            users[p.op_id].comments_received += p.comments_count;

            posts.push(p);
          });
        }
        if (json.paging && json.paging.next)
          callback(null, posts, json.paging.next);
        else
          callback(null, posts, null);
      });
    }
  ], function (err, result, next) {
    async.mapSeries(result, getLikes, function (err, result) {
      return callback(result, next);
    })
  });
}
function getLikes(post, callback) {
  console.debug('Fetching likes for post: ' + post.id);
  if (post.likes_next) {
    request({
      url: post.likes_next,
      method: "GET"
    }, function (err, head, body) {
      var json = JSON.parse(body);
      if (json.data) {
        post.likes_count += json.data.length;
        if (json.paging && json.paging.next) {
          post.likes_next = json.paging.next;
          getLikes(post, callback);
        }
        else {
          getComments(post, function (err, post) {
            return callback(null, post);
          });

        }
      }
    });
  }
  else {
    getComments(post, function (err, post) {
      return callback(null, post);
    });
  }
}

function getComments(post, callback) {
  console.debug('Fetching comments for post: ' + post.id);
  if (post.comments_next) {
    request({
      url: post.comments_next,
      method: "GET"
    }, function (err, head, body) {
      var json = JSON.parse(body);
      if (json.data) {
        post.comments_count += json.data.length;
        json.data.forEach(function (comment) {
          comment.parent = post.id;
          comments.push(comment);

          users[comment.from.id] = users[comment.from.id] || {
            id: comment.from.id,
            name: comment.from.name,
            posts: 0,
            likes_given: 0,
            likes_received: 0,
            comments_given: 0,
            comments_received: 0,
            activity: []
          };
          users[comment.from.id].comments_given += 1;
          users[comment.from.id].likes_received += comment.like_count;
          users[comment.from.id].activity.push({time: comment.created_time, activity: 'comment', resource_id: p.id});
        });
        if (json.paging && json.paging.next) {
          post.comments_next = json.paging.next;
          getComments(post, callback);
        }
        else {
          return callback(null, post);
        }
      }
      else {
        return callback(null, post);
      }
    });
  }
  else {
    return callback(null, post);
  }
}

function pushToElastic(callback) {
  console.info('Shipping results to ES, length: ' + posts.length + ', ' + comments.length + ', ' + Object.keys(users).length);
  var client = new elastic.Client({
    host: 'localhost:9200'
  });

  async.map(posts, function (post, cb) {
    client.index({
      index: 'fb',
      type: 'post',
      id: post.id,
      body: post
    }, cb);
  }, function (err) {
    if (err)
      return callback(err);
    async.map(comments, function (comment, cb) {
      client.index({
        index: 'fb',
        type: 'comment',
        id: comment.id,
        body: comment
      }, cb);
    }, function (err) {
      if (err)
        return callback(err);

      var events = [];
      async.map(Object.keys(users), function (key, cb) {
        var user = users[key];

        user.activity.forEach(function (activity) {
          events.push({
            date: new Date(activity.time).getTime(),
            author: user.name,
            picture: user.picture,
            activity: activity.activity,
            resource_id: activity.resource_id
          });
        });

        client.index({
          index: 'fb',
          type: 'user',
          id: user.id,
          body: user
        }, cb);
      }, function (err) {
        if (err)
          return callback(err);

        fs.writeFileSync(path.join(__dirname, 'data', 'events.json'), JSON.stringify(events));

        return callback(null);
      });
    });
  });
}


function run(next) {
  console.debug('Running cycle for: ' + next);
  getData(next, function (result, next) {
    if (next)
      run(next);
    else {
      pushToElastic(function (err) {
        if (err)
          throw err;
        console.info('All done.');
        process.exit();
      });
    }
  });
}

run("https://graph.facebook.com/v2.3/831617973569325/feed?access_token=" + token);