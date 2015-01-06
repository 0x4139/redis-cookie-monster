# File Cookie Store

redis-cookie-monster is a cookie store backed by redis for tough-cookie module. 


## installation

    $ npm install redis-cookie-monster

## Options

  `connectionstring` of redis

## Usage
```javascript
  var request = require('request');
  var CookieMonster = require('../');
  var redisConnectionString = {
      host: 'host.me',
      port: 6379,
      opts: {
          auth_pass: 'foobar'
      }
  };
  var j = new CookieMonster('0x4139@gmail.com',redisConnectionString);
  request = request.defaults({ jar : request.jar(j) });

  request('https://0x4139.com', function(err, response, body) {
  	console.log(response.headers['set-cookie']);
  });
```
## License

 MIT
