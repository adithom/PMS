#!/usr/bin/env bash
set -euo pipefail

BASE_URL="http://localhost:8080/api"
PROPERTY_CODE="STR"
LOCATION_NAME="Restaurant"
TOKEN_FILE="$HOME/.hms_token"

if [ ! -f "$TOKEN_FILE" ]; then
  echo "No token found at $TOKEN_FILE — run hms-login first"
  exit 1
fi
TOKEN=$(cat "$TOKEN_FILE")

PROPERTY_ID=$(http -b GET "$BASE_URL/properties/code/$PROPERTY_CODE" \
  "Authorization:Bearer $TOKEN" | jq -r '.id')

if [ -z "$PROPERTY_ID" ] || [ "$PROPERTY_ID" = "null" ]; then
  echo "No property found with code $PROPERTY_CODE"
  exit 1
fi
echo "Property $PROPERTY_CODE → $PROPERTY_ID" >&2

LOCATION_ID=$(http -b GET "$BASE_URL/pos/locations" \
  "Authorization:Bearer $TOKEN" \
  propertyId=="$PROPERTY_ID" | jq -r --arg name "$LOCATION_NAME" '.[] | select(.name == $name) | .id')

if [ -z "$LOCATION_ID" ] || [ "$LOCATION_ID" = "null" ]; then
  echo "No POS location named '$LOCATION_NAME' found under property $PROPERTY_CODE"
  exit 1
fi
echo "Location $LOCATION_NAME → $LOCATION_ID" >&2

post_category() {
  local name="$1"
  local order="$2"
  local id
  id=$(http -b POST "$BASE_URL/pos/categories" \
    "Authorization:Bearer $TOKEN" \
    locationId="$LOCATION_ID" \
    name="$name" \
    displayOrder:="$order" | jq -r '.id')
  echo "  Category: $name → $id" >&2
  echo "$id"
}

post_product() {
  local cat_id="$1"
  local name="$2"
  local desc="$3"
  local price="$4"
  http -b POST "$BASE_URL/pos/products" \
    "Authorization:Bearer $TOKEN" \
    locationId="$LOCATION_ID" \
    categoryId="$cat_id" \
    name="$name" \
    description="$desc" \
    price:="$price" \
    isAvailable:=true > /dev/null
  echo "    Product: $name (Rs. $price)" >&2
}

echo "=== Creating categories ==="

CAT_SOUPS=$(post_category "Soups" 1)
CAT_APPS=$(post_category "Appetizers & Salads" 2)
CAT_FARM=$(post_category "Farm to Fork / World Cuisine" 3)
CAT_PASTA=$(post_category "Pasta" 4)
CAT_BREADS=$(post_category "Roti & Breads" 5)
CAT_RICE=$(post_category "Rice & Noodle" 6)
CAT_DESSERTS=$(post_category "Desserts" 7)
CAT_SHORT=$(post_category "Short Eats" 8)
CAT_HOT=$(post_category "Hot Beverages" 9)
CAT_COLD=$(post_category "Cold Beverages" 10)

echo ""
echo "=== Creating products ==="

echo "-- Soups --" >&2
post_product "$CAT_SOUPS" "Papaya Gazpacho" "cold raw vegetable soup, pickled vegetables, feta cheese" 400
post_product "$CAT_SOUPS" "Smoked Tomato and Basil" "charcoal smoked tomato and fresh basil" 400
post_product "$CAT_SOUPS" "Moringa" "ginger, tomato, garlic, olive oil" 450
post_product "$CAT_SOUPS" "Murgh Badami Shorba" "Indian chicken soup infused with almond" 500
post_product "$CAT_SOUPS" "Broccoli and Almond" "saffron and cream" 450
post_product "$CAT_SOUPS" "Lemongrass Chicken Broth" "tomato, lemongrass, lime" 500

echo "-- Appetizers & Salads --" >&2
post_product "$CAT_APPS" "Quinoa" "pomegranate, arugula, beans, basil, almonds, olives" 650
post_product "$CAT_APPS" "Freshly Picked" "in-house garden veggies, lemon, pepper" 650
post_product "$CAT_APPS" "Tandoori Paneer" "grilled courgette, crisp eggplant, balsamic dressing" 650
post_product "$CAT_APPS" "Grilled Coriander Chicken" "string beans, potatoes, tomatoes, olives" 650
post_product "$CAT_APPS" "Papaya & Dry Mango" "black olives, sun dried tomato, alphonso mango & jalapeno dressing" 650
post_product "$CAT_APPS" "Chicken Tikka" "bell peppers, onions, pickled vegetables, tamarind mint sauce" 750
post_product "$CAT_APPS" "Bison Valley Pepper Chicken" "grilled boneless chicken, curry leaves, green pepper, ginger, garlic" 750
post_product "$CAT_APPS" "Crispy Okra" "crisp fried ladies finger, dry mango powder, lime" 650
post_product "$CAT_APPS" "Roasted Chemeen" "grilled tiger prawn, Kerala roasted masala sauce" 750
post_product "$CAT_APPS" "Fish Tikka" "boneless seer fish, bell peppers, onions, pickled vegetables, tamarind mint sauce" 750
post_product "$CAT_APPS" "Malabar Pan Seared Seer Fish" "pan seared seer fish, blend of Malabar spices, onion" 750

echo "-- Farm to Fork / World Cuisine --" >&2
post_product "$CAT_FARM" "Puliyila Meen Chuttathu" "boneless seer fish, tamarind leaves, Kerala spices, baked in clay oven, served with idiyappam" 975
post_product "$CAT_FARM" "Aleppey Mix Vegetable Curry" "fresh seasonal vegetables, coconut milk, blend of Indian spices" 650
post_product "$CAT_FARM" "Bhindi Masala" "okra with Indian spices, onion and tomato" 650
post_product "$CAT_FARM" "Nadan Kozhi Curry" "chicken and potato, local spices, coconut milk and coconut oil, served with coconut rice / appam / idiyappam" 900
post_product "$CAT_FARM" "Murgh Tikka Makhani" "tender chicken, fresh yoghurt, clay oven, butter and tomato gravy" 850
post_product "$CAT_FARM" "Cottage Cheese at Its Best" "cottage cheese preparation of your choice — makhni / palak / kadai / shahi" 700
post_product "$CAT_FARM" "Travancore Meen Curry" "seared fish, kokum flavored coconut cream" 850
post_product "$CAT_FARM" "Yellow Dhal" "turmeric, ginger, garlic and cumin seeds" 500
post_product "$CAT_FARM" "Grilled Breast of Chicken" "chicken, herbs, garlic, lime juice, barbecue sauce, grilled seasonal vegetables, herbed rice / mashed potatoes" 975
post_product "$CAT_FARM" "Nutmeg Lamb Curry" "tender lamb, nutmeg, onion, tomato, local spices, served with appam / idiyappam" 975
post_product "$CAT_FARM" "Moilee (Prawn / Fish)" "prawn / seer fish, coconut gravy, shallot, curry leaf, cashew and raisin tempering, served with appam / idiyappam" 975
post_product "$CAT_FARM" "Khumb Matar" "mushroom and green pea flavored with cumin" 750
post_product "$CAT_FARM" "Kerala Thali (Vegetables)" "multi-course traditional Kerala meal on banana leaf — vegetables" 900
post_product "$CAT_FARM" "Kerala Thali (Chicken / Beef)" "multi-course traditional Kerala meal on banana leaf — chicken / beef" 950
post_product "$CAT_FARM" "Kerala Thali (Fish / Prawn)" "multi-course traditional Kerala meal on banana leaf — fish / prawn" 975
post_product "$CAT_FARM" "Breaded Chicken Breast" "green tea flavored orange sauce, herbed rice / mashed potatoes" 975
post_product "$CAT_FARM" "Muttukadu Beef Roast" "beef tenderloin, local spices, coconut milk, served with kallappam" 975
post_product "$CAT_FARM" "Tenderloin Steak" "char grilled prime tenderloin, grilled seasonal vegetables, herbed rice / mashed potatoes" 975

echo "-- Pasta --" >&2
post_product "$CAT_PASTA" "Aglio e Olio" "garlic, olive oil, parsley and parmigiano-reggiano" 900
post_product "$CAT_PASTA" "Arrabiata" "garlic, tomato and chilli flakes in olive oil" 900
post_product "$CAT_PASTA" "Alfredo" "parmigiano-reggiano, butter, garlic, chicken / prawn" 900
post_product "$CAT_PASTA" "Roast Beef Pasta" "Kerala beef roast, caramelized onion, cheddar and parmigiano-reggiano" 900

echo "-- Roti & Breads --" >&2
post_product "$CAT_BREADS" "Roti" "tandoori / butter / garlic" 200
post_product "$CAT_BREADS" "Paratha" "laccha / pudina / aloo / paneer" 200
post_product "$CAT_BREADS" "Naan" "butter / garlic" 200
post_product "$CAT_BREADS" "Phulka" "" 150
post_product "$CAT_BREADS" "Chapati" "" 150

echo "-- Rice & Noodle --" >&2
post_product "$CAT_RICE" "Rice" "unpolished / pulao / jeera / ghee / tomato / coconut" 350
post_product "$CAT_RICE" "Noodle" "vegetables / chicken / egg / szechuan-veg / szechuan-non-veg" 750
post_product "$CAT_RICE" "Fried Rice" "vegetables / chicken / egg / szechuan-veg / szechuan-non-veg" 750

echo "-- Desserts --" >&2
post_product "$CAT_DESSERTS" "Planter's Vanilla Dream" "caramelised banana and ice cream" 350
post_product "$CAT_DESSERTS" "Seasonal Sorbet" "butterfly pea flower / mint tamarind / raw mango" 300
post_product "$CAT_DESSERTS" "Ice Cream" "ask for selection" 300
post_product "$CAT_DESSERTS" "Payasam" "day's special" 300
post_product "$CAT_DESSERTS" "House-Made Chocolate Brownie" "with ice cream" 350
post_product "$CAT_DESSERTS" "Tender Coconut and Cardamom Souffle" "with jackfruit sauce" 350
post_product "$CAT_DESSERTS" "Arrowroot Pudding" "with jackfruit sauce" 300

echo "-- Short Eats --" >&2
post_product "$CAT_SHORT" "Vegetarian Short Eat" "banana fritters / samosa / spring roll / nuggets / pakora" 300
post_product "$CAT_SHORT" "Non-Vegetarian Short Eat" "samosa / spring roll / nuggets" 350
post_product "$CAT_SHORT" "Garlic Bread" "" 350
post_product "$CAT_SHORT" "French Fries" "" 250
post_product "$CAT_SHORT" "Sandwich of the Day (Veg)" "vegetables" 700
post_product "$CAT_SHORT" "Sandwich of the Day (Chicken)" "chicken" 750

echo "-- Hot Beverages --" >&2
post_product "$CAT_HOT" "White Tea" "" 250
post_product "$CAT_HOT" "Green Tea" "" 100
post_product "$CAT_HOT" "Blue Tea" "" 250
post_product "$CAT_HOT" "Fresh Mint Tea" "" 150
post_product "$CAT_HOT" "Cardamom Tea" "" 150
post_product "$CAT_HOT" "Masala Tea" "" 150
post_product "$CAT_HOT" "Orthodox Tea" "" 150
post_product "$CAT_HOT" "French Roast Coffee" "" 150
post_product "$CAT_HOT" "Filter Coffee" "" 150
post_product "$CAT_HOT" "Hot Chocolate" "" 200

echo "-- Cold Beverages --" >&2
post_product "$CAT_COLD" "Pineapple Ginger Lifter" "pineapple, ginger, honey, mint leaves" 300
post_product "$CAT_COLD" "Watermelon Punch" "watermelon, orange, lemon juice, mint" 300
post_product "$CAT_COLD" "Cucumber" "with a dash of mint and lime" 300
post_product "$CAT_COLD" "Beet" "beetroot, ginger, orange" 300
post_product "$CAT_COLD" "Freshly Squeezed" "ask for selection" 300
post_product "$CAT_COLD" "Freshly Blended (Strawberry Banana)" "strawberry and banana milkshake" 400
post_product "$CAT_COLD" "Freshly Blended (Cacao Almond)" "cacao almond milkshake" 400

echo ""
echo "=== Done: 10 categories, 81 products imported ==="
