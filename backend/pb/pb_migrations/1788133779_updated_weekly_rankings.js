/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1671832905")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX idx_unique_ranking ON weekly_rankings (player, format, week, year)"
    ]
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1671832905")

  // update collection data
  unmarshal({
    "indexes": []
  }, collection)

  return app.save(collection)
})
