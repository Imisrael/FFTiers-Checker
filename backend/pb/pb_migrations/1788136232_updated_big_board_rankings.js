/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1069735522")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX idx_unique_big_board ON big_board_rankings (player, format)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1069735522")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
