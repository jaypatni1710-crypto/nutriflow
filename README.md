# Run backend locally for that use: 
**cd backend
npm install
npm run dev**

# Run Frontend Locally for that use:
**cd frontend
npm install
npm run dev**



# To Deploye in both frontend and backend 
**export CLOUDFLARE_API_TOKEN="api token"** 
(this token u can find on the cloudflar > profile > api tokens 
where,
step 1: create token > edit worker > then just add account - hyperdrive -edit
and select individual and email and nelow that again email and then click on the create or summery)
this step only when u run in the Github CodeSpace otherewise use wrangler login 

Then use: **npm run build** for both:
**wrangler deploy** for backend
**wrangler pages deploy dist --project-name=nutriflow** for frontend
