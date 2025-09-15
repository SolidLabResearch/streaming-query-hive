#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Remove all emojis from text using comprehensive regex patterns
 */
function removeEmojis(text) {
    // Comprehensive emoji regex patterns
    const emojiPatterns = [
        // Unicode emoji ranges
        /[\u{1F600}-\u{1F64F}]/gu,  // Emoticons
        /[\u{1F300}-\u{1F5FF}]/gu,  // Symbols & Pictographs
        /[\u{1F680}-\u{1F6FF}]/gu,  // Transport & Map
        /[\u{1F1E0}-\u{1F1FF}]/gu,  // Regional indicator symbols (flags)
        /[\u{2600}-\u{26FF}]/gu,    // Miscellaneous Symbols
        /[\u{2700}-\u{27BF}]/gu,    // Dingbats
        /[\u{1F900}-\u{1F9FF}]/gu,  // Supplemental Symbols and Pictographs
        /[\u{1F018}-\u{1F270}]/gu,  // Various symbols
        /[\u{238C}-\u{2454}]/gu,    // Miscellaneous symbols
        /[\u{20D0}-\u{20FF}]/gu,    // Combining diacritical marks for symbols
        
        // Common text-based emojis
        /||||||||||||||||||||/g,
        
        // Additional common emojis that might be missed
        /[]/g
    ];
    
    let cleanText = text;
    emojiPatterns.forEach(pattern => {
        cleanText = cleanText.replace(pattern, '');
    });
    
    return cleanText;
}

/**
 * Check if file should be processed
 */
function shouldProcessFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const allowedExtensions = ['.ts', '.js', '.json', '.md', '.txt', '.yml', '.yaml'];
    
    // Skip node_modules, .git, dist, build directories
    const skipDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
    const relativePath = path.relative(process.cwd(), filePath);
    
    if (skipDirs.some(dir => relativePath.includes(dir))) {
        return false;
    }
    
    return allowedExtensions.includes(ext);
}

/**
 * Process a single file
 */
function processFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const cleanContent = removeEmojis(content);
        
        if (content !== cleanContent) {
            fs.writeFileSync(filePath, cleanContent, 'utf8');
            console.log(`Cleaned emojis from: ${path.relative(process.cwd(), filePath)}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error(`Error processing ${filePath}: ${error.message}`);
        return false;
    }
}

/**
 * Recursively process directory
 */
function processDirectory(dirPath) {
    let filesProcessed = 0;
    
    try {
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stats = fs.statSync(fullPath);
            
            if (stats.isDirectory()) {
                filesProcessed += processDirectory(fullPath);
            } else if (stats.isFile() && shouldProcessFile(fullPath)) {
                if (processFile(fullPath)) {
                    filesProcessed++;
                }
            }
        }
    } catch (error) {
        console.error(`Error processing directory ${dirPath}: ${error.message}`);
    }
    
    return filesProcessed;
}

/**
 * Main execution
 */
function main() {
    console.log('Starting emoji removal process...');
    console.log('Processing directory:', process.cwd());
    
    const startTime = Date.now();
    const filesProcessed = processDirectory(process.cwd());
    const endTime = Date.now();
    
    console.log(`\nEmoji removal completed!`);
    console.log(`Files processed: ${filesProcessed}`);
    console.log(`Time taken: ${endTime - startTime}ms`);
    
    if (filesProcessed === 0) {
        console.log('No emojis found in any files.');
    } else {
        console.log(`Successfully removed emojis from ${filesProcessed} files.`);
    }
}

// Run the script
main();
