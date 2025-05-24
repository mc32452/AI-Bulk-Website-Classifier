# Bulk Website Classifier

A modern web application for classifying websites in bulk using AI-powered analysis. Built with Next.js and shadcn/ui, this tool analyzes websites and categorizes them as Marketing, Portal, or Other based on their content and structure.

## Features

- **Bulk Domain Processing**: Classify multiple websites simultaneously
- **AI-Powered Analysis**: Uses OpenAI GPT models for intelligent classification
- **Flexible Configuration**: Choose between HTML and OCR analysis methods
- **Real-time Progress**: Track processing status with live updates
- **Results Management**: Filter, search, and export classification results
- **Modern UI**: Built with shadcn/ui components for a polished user experience

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Python 3.8+ with required dependencies
- OpenAI API key

### Installation

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd bulk-web-describer
   ```

2. **Install frontend dependencies**:
   ```bash
   cd website-classifier
   npm install
   ```

3. **Install backend dependencies**:
   ```bash
   cd ..
   pip install -r backend_requirements.txt
   ```

4. **Set up environment variables**:
   ```bash
   # In the root directory, create or update .env
   echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
   
   # In website-classifier directory, create .env.local
   cd website-classifier
   echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:5000" > .env.local
   ```

### Running the Application

**Option 1: Use the startup script (recommended)**
```bash
# From the root directory
chmod +x start.sh
./start.sh
```

**Option 2: Manual startup**
```bash
# Terminal 1: Start the Flask backend
python flask_backend.py

# Terminal 2: Start the Next.js frontend
cd website-classifier
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Usage

1. **Input Domains**: Enter website URLs in the textarea (one per line)
2. **Configure Settings**: 
   - Choose analysis method (HTML or OCR)
   - Set worker threads for parallel processing
   - Enable/disable headless mode and anti-detection
3. **Start Processing**: Click "Start Classification" to begin analysis
4. **Monitor Progress**: Watch real-time progress and statistics
5. **Review Results**: View classified websites in the results table
6. **Export Data**: Download results as CSV for further analysis

## Configuration Options

- **Analysis Method**: HTML parsing (faster) or OCR (more comprehensive)
- **Worker Threads**: Number of parallel processing threads (1-10)
- **Headless Mode**: Run browser automation in background
- **Anti-Detection**: Use stealth techniques to avoid bot detection
- **Overwrite Results**: Replace existing classifications or skip duplicates

## API Endpoints

- `POST /api/process`: Real-time website classification
- `POST /api/process-mock`: Mock endpoint for testing (returns sample data)

## Tech Stack

### Frontend
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Modern component library
- **Lucide React**: Icon library

### Backend
- **Flask**: Python web framework
- **OpenAI API**: GPT-powered text analysis
- **Selenium**: Web scraping and automation
- **Tesseract OCR**: Optical character recognition

## Project Structure

```
website-classifier/
├── src/
│   ├── app/
│   │   ├── api/           # API routes
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Main page
│   ├── components/
│   │   ├── ui/            # shadcn/ui components
│   │   └── WebsiteClassifier.tsx  # Main app component
│   └── lib/
│       └── utils.ts       # Utility functions
├── public/                # Static assets
└── ...config files
```

## Development

### Adding New Features

1. **Components**: Add new UI components in `src/components/`
2. **API Routes**: Create new endpoints in `src/app/api/`
3. **Styling**: Use Tailwind classes and shadcn/ui components
4. **Types**: Define TypeScript interfaces for data structures

### Testing

```bash
# Run development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Troubleshooting

**Common Issues:**

1. **Backend not starting**: Check Python dependencies and OpenAI API key
2. **CORS errors**: Ensure backend URL is correctly set in `.env.local`
3. **Classification errors**: Verify OpenAI API key and internet connection
4. **Performance issues**: Reduce worker threads or switch to HTML-only analysis

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Next.js Resources

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial
- [shadcn/ui](https://ui.shadcn.com/) - component library documentation
