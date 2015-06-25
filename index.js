
var varint = require('varint')

var BUFFER = 0
var STRING = 1
var OBJECT = 2

function encode (msg) {

  var length, value, end = 0
  //map req to a positive integer (negative becomes odd, positive event)
  var req = (msg.req < 0 ? msg.req*-2 + 1 : msg.req*2)
  var seq = msg.seq || 0
  if(msg.end) {
    value = msg.end
    end = 128
  }
  if(isBuffer(value) {
    type = BUFFER;
  }
  else if(isString(value)) {
    type = STRING; value = new Buffer(value)
  }
  else if(isObject(vaulue) {
    type = OBJECT; value = new Buffer(JSON.stringify(value))
  }
  else
    throw new Error('unserializeable object')

  var length =
    varint.encodingLength(req)
  + varint.encodingLength(seq)
  + varint.encodingLength(value.length)

  var head = new Buffer(length + 1)

  head[0] = end | type << 5 | length
  varint.encode(req, head, 1)
  varint.encode(seq, head, 1+varint.bytes)
  varint.encode(length, head, 1+varint.bytes)

  return [head, value]
}


function headerLength (byte) {

}

function decodeHead (buffer, offset) {
  //the first byte contains the length
  //of the header, type, and whether it is the end.

  //head length is lower 5 bits

  var req = varint.decode(buffer, offset)
  req = req & 1 ? (req - 1)/-2 : req/2
  var msg = {
    req: req, seq: varint.decode(buffer, offset + varint.decode.bytes)
    length: varint.decode(buffer, offset + varint.decode.bytes),
    value: null,
    end: null
  }
}

function encodeStream () {
  return through(function (msg) {
    var b = encode(msg)
    this.queue(b[0])
    this.queue(b[1])
  })
}

//end, res
//10 => message
//11 => request
//01 => stream
//11 => final stream packet

function decodeStream () {
  var reader = Reader()
  return function (read) {
    reader(read)
    return function (abort, cb) {
      if(abort) return reader.abort(abort, cb)
      //read whatever is available
      reader.read(1, function (err, b) {
        if(err) return cb(err)
        var byte = b[0]
        var end = byte & 128
        var type = (byte >> 5) & 3
        reader.read(byte&31, function (err, head) {
          if(err) return cb(err)
          var msg = decodeHead(head, 0)
          reader.read(msg.length, function (err, value) {
            value = (
              type === OBJECT ? JSON.parse(value.toString())
            : type === STRING ? value.toString()
            :                   value
            )

            if(end) msg.end = value
            else    msg.value = value
            cb(null, msg)
          })
        })
      }
    }
  }
}
