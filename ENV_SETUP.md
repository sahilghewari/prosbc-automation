# Environment Setup Guide

## Setting up ProSBC Credentials

1. **Edit the `.env` file** in the project root
2. **Replace the placeholder values** with your actual ProSBC credentials:

```env
# ProSBC Authentication Credentials
VITE_PROSBC_USERNAME=your_actual_username
VITE_PROSBC_PASSWORD=your_actual_password
```

## Example:
If your ProSBC login is:
- Username: `admin`
- Password: `mypassword123`

Then your `.env` file should look like:
```env
VITE_PROSBC_USERNAME=admin
VITE_PROSBC_PASSWORD=mypassword123
```

## Important Notes:
- The `VITE_` prefix is required for Vite to expose these variables to the client
- Never commit your `.env` file to version control (it's already in `.gitignore`)
- Restart the development server after changing the `.env` file
- Make sure your ProSBC server is accessible and the credentials are correct

## Testing the Setup:
1. Edit your `.env` file with real credentials
2. Restart the dev server: `npm run dev`
3. The app should automatically authenticate using basic auth
4. Try creating or listing NAPs to verify the connection works
