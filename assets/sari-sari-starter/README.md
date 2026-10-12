# Sari Sari Store starter inventory

This is synthetic inventory intended to become your actual starting catalog.
Review the prices, unit costs and opening stock before importing. All money in
the SQL is in centavos: `5500` means PHP 55.00. Each stock unit is the piece,
pack, sachet, bottle or prepacked kilogram in the product name.

The catalog has 40 products in 9 categories and uses 21 representative Pexels
photos, shared between size/flavor variants. These photos illustrate product
types; they do not establish an exact brand, package, flavor or quantity match.

## Import products

1. Open `supabase/seeds/sari_sari_products.sql`, copy its entire contents, and run
   it in Supabase SQL Editor as the project owner.
2. It targets the existing store named **Sari Sari Store**, with one active Manager
   who has already signed in. It aborts if that store name is missing or ambiguous.
3. The result includes `storage_folder`. Copy that value; it looks like
   `YOUR_STORE_UUID/starter`.

Existing SKUs are skipped. Re-running does not reset inventory, prices, accounts
or sales. New products record their opening stock movements and an import run.

## Upload and link photos

1. Extract `assets/sari-sari-starter-images.zip`.
2. Open Supabase **Storage → product-images**. Keep this bucket private.
3. Create/open the folder for your store UUID and a `starter` folder inside it,
   matching `storage_folder` from the SQL result.
4. Upload all 21 JPG files **inside the ZIP's images folder** into that `starter`
   folder. Do not upload the parent `images` folder or rename the files.
5. Run the same SQL again. It links uploaded images to products that have no photo,
   while preserving existing photos and current stock. Refresh SmartPOS.

For example, the rice object's full storage name must be
`YOUR_STORE_UUID/starter/rice.jpg`. The SQL checks actual Storage objects before
attaching any image. SQL alone cannot upload the photo bytes.

Image credits and source pages are listed in `IMAGE-CREDITS.md` and
`image-sources.json`. Pexels license: https://www.pexels.com/license/.
