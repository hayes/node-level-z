var sublevel = require('level-sublevel')
var extend = require('util')._extend
var interleave = require('interleave26')
var PassThrough = require('stream').PassThrough

var defaultOptions = {
  keys: ['lon', 'lat'],
  bounds: [[-180, 180], [90, -90]]
}

module.exports = function levelZ (db, name, options) {
  options = extend(extend({}, defaultOptions), options || {})
  var zdb = sublevel(db).sublevel(name, {valueEncoding: 'json'})
  var indexDb = zdb.sublevel('level-z-index')
  var x_prop = options.keys[0]
  var y_prop = options.keys[1]
  var bounds = options.bounds.slice()
  var depth = 26
  var prefix = Array(depth + 1).join('0')
  bounds[0].sort(byNum)
  bounds[1].sort(byNum)
  var xMin = bounds[0][0]
  var yMin = bounds[1][0]
  var xRange = bounds[0][1] - xMin
  var yRange = bounds[1][1] - yMin

  zdb.pre(writeIndex)

  return {
    get: getById,
    put: zdb.put,
    del: zdb.del,
    createReadStream: zdb.createReadStream,
    inBoundingBox: inBoundingBox,
    decodeKey: decodeKey
  }

  function inBoundingBox (bounds) {
    bounds = bounds.slice()
    bounds[0].sort(byNum)
    bounds[1].sort(byNum)
    var left = bounds[0][0]
    var right = bounds[0][1]
    var top = bounds[1][0]
    var bottom = bounds[1][1]
    var xDiff = (right - left) / 2
    var yDiff = (bottom - top) / 2
    var xRatio = xRange / xDiff
    var yRatio = yRange / yDiff

    var test = Math.max(xRatio, yRatio)

    var searchDepth = 0
    while ((test >>= 1)) searchDepth += 1

    searchDepth = Math.min(depth, searchDepth)
    var ranges = []
    var i, j

    for (i = 0; i < 3; ++i) {
      for (j = 0; j < 3; ++j) {
        var currentX = (left + (j * xDiff) - xMin) % xRange
        if (currentX < 0) currentX = xRange + currentX
        var key = getKeyInt(currentX + xMin, top + (i * yDiff), searchDepth)
        ranges.push([
          formatKey(key, searchDepth),
          formatKey(key + 1, searchDepth)
        ])
      }
    }

    ranges.sort()
    var last = ranges[0]
    var merged = [last]

    for (i = 1; i < 9; ++i) {
      if (ranges[i][0] <= last[1]) {
        last[1] = ranges[i][1]
        continue
      }
      last = ranges[i]
      merged.push(last)
    }

    var output = new PassThrough({objectMode: true})
    var remaining = merged.length

    if (!remaining) output.end()

    for (i = 0; i < merged.length; ++i) {
      var stream = zdb.createValueStream({gte: merged[i][0], lte: merged[i][1]})
      stream.pipe(output, {end: false})
      stream.on('end', function () {
        if (!--remaining) output.end()
      })
    }

    return output
  }

  function writeIndex (op, add) {
    if (!op.value || op.type !== 'put') return
    var y = op.value[y_prop]
    var x = op.value[x_prop]
    if (x === undefined || y === undefined) return

    var key = getKey(op.key, x, y)

    add({
      type: op.type,
      key: op.key,
      value: key,
      prefix: indexDb.prefix()
    })

    op.key = key
  }

  function getById (id, options, cb) {
    indexDb.get(id, function (err, val) {
      if (err) return cb(err)
      zdb.get(val, options, cb)
    })
  }

  function getKey (id, x, y) {
    return (prefix + getKeyInt(x, y, depth).toString(2)).slice(-(depth * 2)) + '-' + id
  }

  function getKeyInt (x, y, depth) {
    var size = Math.pow(2, depth) - 1

    return interleave(
      Math.round((y - yMin) / yRange * size),
      Math.round((x - xMin) / xRange * size)
    )
  }

  function formatKey (key, keyDepth) {
    key = key * Math.pow(2, (depth - keyDepth) * 2)
    return (prefix + key.toString(2)).slice(-(depth * 2))
  }

  function decodeKey (key) {
    var even = ''
    var odd = ''

    for (var i = 0; i < key.length; i += 2) {
      even += key[i]
      odd += key[i + 1]
    }

    even = parseInt(even, 2) * yRange / Math.pow(2, 26) + yMin
    odd = parseInt(odd, 2) * xRange / Math.pow(2, 26) + xMin

    return [even, odd]
  }
}

function byNum (a, b) {
  return +a > +b
}
