/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1671832905")

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "number3145888567",
    "max": null,
    "min": null,
    "name": "year",
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
  collection.fields.removeById("number3145888567")

  return app.save(collection)
})
