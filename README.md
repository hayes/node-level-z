# level-z

levelZ creates a sublevel db with the passed in name, that will insert items using
their z-order index, so they can easily be queried by location. Items can still
be retrieved efficiently by their primary id (this now requires 2 lookups rather than 1).


the new db has the following methods:

* get: get entry by original id
* put: insert an item by id, item should also have lat/long keys (items currently do not support being moved)
* del: delete an item
* createReadStream: default level readstream (note that keys are a z-order index, rather than insert key)
* inBoundingBox: inBoundingBox: returns a stream of entries within (or close to) the bounding box.
  takes 1 arg: [[xMin, xMax], [yMin, yMax]]


```javascript
var map = levelZ(db, 'map', {
  keys: ['long', 'lat'],
  bounds: [[-180, 180], [90, -90]]
})

var n = 0;
for (var i = -18; i <= 18; ++i) {
  for (var j = -9; j <= 9; ++j) {
    grid.put(n++, {
      long: i * 10,
      lat: j * 10,
      key: n,
      value: i * j
    })
  }
}

map.inBoundingBox([[-10, 10], [10,-10]]).on('data', function (location) {
  console.log(location)
})
```

Note: currently bounding box results are not filtered, so they may contain locations near
the search area that are slightly outside the bounding box.
