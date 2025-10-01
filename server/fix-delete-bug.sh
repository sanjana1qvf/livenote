#!/bin/bash

echo "🔧 Fixing deleteLecture bug in all server files..."

# List of files to fix
files=(
    "index.js"
    "index-sequential-backup.js"
    "index-enhanced.js"
    "index-classroom-enhanced.js"
    "index-render-compatible.js"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "Fixing $file..."
        sed -i '' 's/await db\.deleteLecture(req\.params\.id);/await db.deleteLecture(req.params.id, req.user.id);/g' "$file"
        echo "✅ Fixed $file"
    else
        echo "⚠️  $file not found, skipping"
    fi
done

echo "🎉 Delete bug fix completed!"
echo "📝 All deleteLecture calls now include user ID parameter"
