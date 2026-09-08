export const ApiInfo = {
    API_URL: "https://realt.by/bff/graphql",
    MINSK_TOWN_UUID: "4cb07174-7b00-11eb-8943-0cc47adabd66",
    FLATS_CATEGORY: 5,
    PAGE_SIZE: 50,
    SEARCH_QUERY: `
      query searchObjectsV2($data: GetObjectsByAddressInputV2!) {
    searchObjectsV2(data: $data) {
      body {
        pagination { page pageSize totalCount }
        results {
          uuid
          unid
          createdAt
          updatedAt
          address
          townName
          stateDistrictName
          location
          price
          priceCurrency
          pricePerM2
          priceChangeDirection
          priceChangeDate
          rooms
          areaTotal
          areaLiving
          areaKitchen
          balconyType
          storey
          storeys
          buildingYear
          wallMaterial
          repairState
          metroStationName
          metroLineId
          metroTime
          images
          headline
          description
          seller
          agencyName
          agencyUuid
        }
      }
    }
  }
    `
} as const