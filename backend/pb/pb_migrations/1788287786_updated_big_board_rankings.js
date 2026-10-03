/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1069735522")

  // add field
  collection.fields.addAt(6, new Field({
    "hidden": false,
    "id": "number1322813762",
    "max": null,
    "min": 1,
    "name": "positionRanking",
    "onlyInt": false,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1069735522")

  // remove field
  collection.fields.removeById("number1322813762")

  return app.save(collection)
})
