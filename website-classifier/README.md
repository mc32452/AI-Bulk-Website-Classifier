# Bulk Website Classifier

A modern web application for classifying websites in bulk using AI-powered analysis. Built with Next.js and shadcn/ui, this tool analyzes websites and categorizes them as Marketing, Portal, or Other based on their content and structure.

## Features

- **Bulk Domain Processing**: Classify multiple websites simultaneously
- **AI-Powered Analysis**: Uses OpenAI GPT models for intelligent classification
- **Streaming Processing & Real-time Updates**: Track processing status with live updates and see results as they come in
- **Domain Validation**: Validates domain format before processing
- **Flexible Configuration**: Choose between HTML and OCR analysis methods
- **Results Management**: Filter, search, and export classification results
- **Modern UI**: Built with Next.js and shadcn/ui for a polished user experience

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
   pip install -r requirements.txt 
   ```

4. **Set up environment variables**:
   ```bash
   # In the root directory (bulk-web-describer), create or update .env
   echo "OPENAI_API_KEY=your_openai_api_key_here" > .env
   
   # In website-classifier directory, create .env.local
   cd website-classifier
   echo "NEXT_PUBLIC_BACKEND_URL=http://localhost:5001" > .env.local 
   echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api" >> .env.local
   ```

### Running the Application

**Option 1: Use the startup script (recommended)**
This script handles starting both the backend and frontend.
```bash
# From the root directory (bulk-web-describer)
chmod +x start.sh
./start.sh
```

**Option 2: Manual startup**
```bash
# Terminal 1: Start the Flask backend
# Ensure you are in the root directory (bulk-web-describer)
python flask_backend_enhanced.py

# Terminal 2: Start the Next.js frontend
# Ensure you are in the website-classifier directory
cd website-classifier
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## Usage

1. **Input Domains**: Enter website URLs in the textarea (one per line). Invalid domains will be flagged.
2. **Configure Settings**: 
   - Choose text extraction method (HTML Parsing or OCR Screenshots).
   - Set worker threads for parallel processing (1-8).
   - Enable/disable headless mode for browser automation.
   - Optionally enable anti-detection measures.
   - Decide whether to overwrite existing results for previously scanned domains.
3. **Start Analysis**: Click "Start Analysis" to begin.
4. **Monitor Progress**: Observe real-time progress, including individual domain status and overall completion.
5. **Review Results**: View classified websites in the sortable and searchable results table.
6. **View Detailed Summary**: Click the eye icon to see a detailed summary for a specific domain.
7. **Export Data**: Download results as a CSV file for further analysis.

## Configuration Options

- **Analysis Method**: HTML parsing (faster) or OCR (more comprehensive)
- **Worker Threads**: Number of parallel processing threads (1-8).
- **Headless Mode**: Run browser automation in the background.
- **Anti-Detection**: Attempt to use stealth techniques to avoid bot detection (use responsibly).
- **Overwrite Existing Results**: If checked, re-processes and overwrites data for domains already in the database. Otherwise, skips them.

## API Endpoints

The application uses several API endpoints for its operations. Key endpoints include:

- `POST /api/process-stream`: Initiates real-time website classification with streaming results.
- `GET /api/health` (Backend): Checks the health of the Python backend (implicitly used by the frontend).
- `GET /api/results`: Fetches stored classification results.
- `GET /api/statistics`: Retrieves summary statistics.
- `POST /api/export`: Handles exporting data (e.g., as CSV).
- `GET /api/batches` (Potentially): May be used for managing batches of domains if this feature is further developed.

Note: Some API routes like `/api/process` and `/api/process-mock` might still exist but `/api/process-stream` is the primary one for current functionality.

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
