/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3072146508")

  // remove field
  collection.fields.removeById("number614373258")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3072146508")

  // add field
  collection.fields.addAt(2, new Field({
    "hidden": false,
    "id": "number614373258",
    "max": null,
    "min": null,
    "name": "tier",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
})
