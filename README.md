# Run backend locally for that use: 
cd backend
npm install
npm run dev

# For Frontend:
cd frontend
npm install
npm run dev



# To Deploye in both frontend and backend 
export CLOUDFLARE_API_TOKEN="cfut_q6IoCUDVP9gpZEiEFXV6XQQnJTEnjyBRGvACX4qh09e521d9" 
(this is the token which u can find on the cloudflar > profile > api tokens where create token then edit worker > then just add account - hyperdrive -edit and create then past key in above text)
this step only when u run in the Github CodeSpace otherewise use wrangler login 

then use npm run build 
wrangler deploy for backend
wrangler pages deploy dist --project-name=nutriflow



@jaypatni1710-crypto ➜ /workspaces/nutriflow/backend (main) $ npx web-push generate-vapid-keys

=======================================

Public Key:
BIN9E5pNgR2d7ic9z7WF4mxSqsWbQtRZnetBWxYh9UYtpC6DCXWABlURWVX7VOBm8IBXz69Jdra8GhS-kBhpDbY

Private Key:
2u8wWwZC6aLUjhL5DqyAgi1kYS_9CXJxEsTVmfOXiCI

=======================================
