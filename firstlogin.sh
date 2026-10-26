#!/bin/bash
#this will check if any command fail not only the last command

set -o pipefail
#not allowing other to execute the file
umask 077
#exit when any command fails
set -e

# Ensure the script runs as root
if [[ "$EUID" -ne 0 ]]; then
    echo "ERROR: Run this script as root or using sudo."
    exit 1
fi

# Check required commands
for cmd in useradd chpasswd chage openssl mail; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "ERROR: Required command '$cmd' is not installed."
        exit 1
    fi
done

echo "======================================"
echo " Linux User Creation"
echo "======================================"

# Ask for username
read -r -p "Enter username: " username

# Validate username
if [[ ! "$username" =~ ^[a-z_][a-z0-9_-]*\$?$ ]]; then
    echo "ERROR: Invalid username."
    exit 1
fi

# Check whether the user already exists
if id "$username" >/dev/null 2>&1; then
    echo "ERROR: User '$username' already exists."
    exit 1
fi

# Ask for email
read -r -p "Enter email address: " email

# Basic email validation
if [[ ! "$email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]]; then
    echo "ERROR: Invalid email address."
    exit 1
fi

# Generate a random temporary password
temp_password=$(openssl rand -base64 24 | tr -d '\n')

if [[ -z "$temp_password" ]]; then
    echo "ERROR: Password generation failed."
    exit 1
fi

# Create the Linux user
if ! useradd -m -s /bin/bash "$username"; then
    echo "ERROR: Failed to create user."
    exit 1
fi

# Set temporary password
if ! printf '%s:%s\n' "$username" "$temp_password" | chpasswd; then
    userdel -r "$username" 2>/dev/null
    unset temp_password
    echo "ERROR: Failed to set password."
    exit 1
fi

# Force password change at first login
if ! chage -d 0 "$username"; then
    passwd -l "$username"
    unset temp_password
    echo "ERROR: Could not enforce first-login password change."
    exit 1
fi

# Prepare email
subject="Linux Account Created - $username"

body=$(cat <<EOF
Hello,

Your Linux account has been created.

Username: $username
Temporary Password: $temp_password

IMPORTANT:
1. Log in using your temporary password.
2. Change your password when prompted.
3. Your temporary password should not be reused.

Please contact the system administrator if you have trouble logging in.

Regards,
System Administrator
EOF
)

# Send email
if printf '%s\n' "$body" | mail -s "$subject" "$email"; then
    echo "======================================"
    echo "User created successfully."
    echo "Username: $username"
    echo "Email notification submitted."
    echo "Password change required at first login."
    echo "======================================"
else
    # Prevent access if credentials could not be delivered.
    passwd -l "$username"
    echo "ERROR: Email delivery failed."
    echo "The account has been locked for security."
    echo "Please configure email delivery and reset the password."
    unset temp_password body
    exit 1
fi

# Clear temporary variables
unset temp_password body

exit 0
