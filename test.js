var level = require('levelup')
var memdown = require('memdown')
var levelZ = require('./index.js')
var assert = require('assert')


var db = level('./db', {db: memdown})

var grid = levelZ(db, 'grid', {
  keys: ['x', 'y']
})

var n = 0;
for (var i = -18; i <= 18; ++i) {
  for (var j = -9; j <= 9; ++j) {
    grid.put(n++, {
      x: i * 10,
      y: j * 10,
      key: n,
      value: i * j
    })
  }
}

var results = []
grid.inBoundingBox([[-10, 10], [10,-10]]).on('data', function (location) {
  results.push(location)
}).on('end', function () {
  assert.equal(results.length, 9)
  assert.equal(JSON.stringify(results), JSON.stringify([
    { x: -10, y: -10, key: 332, value: 1 },
    { x: -10, y: 0, key: 333, value: 0 },
    { x: 0, y: -10, key: 351, value: 0 },
    { x: 0, y: 0, key: 352, value: 0 },
    { x: -10, y: 10, key: 334, value: -1 },
    { x: 10, y: -10, key: 370, value: -1 },
    { x: 10, y: 0, key: 371, value: 0 },
    { x: 0, y: 10, key: 353, value: 0 },
    { x: 10, y: 10, key: 372, value: 1 }
  ]))
  console.log('ok')
})
