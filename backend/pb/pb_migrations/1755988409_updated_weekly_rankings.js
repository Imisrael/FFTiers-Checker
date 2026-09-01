/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1671832905")

  // add field
  collection.fields.addAt(7, new Field({
    "hidden": false,
    "id": "number2442548793",
    "max": null,
    "min": null,
    "name": "positionRank",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1671832905")

  // remove field
  collection.fields.removeById("number2442548793")

  return app.save(collection)
})
