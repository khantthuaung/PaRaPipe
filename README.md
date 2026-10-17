# PaRaPipe

PaRaPipe records lectures and creates study notes on your computer.
You do not need an account.

## Functions

- Create and remove subjects.
- Record, pause, and save lecture audio.
- Type personal notes during a recording.
- Change recorded speech to text with Whisper Small.
- Create separate study notes with Qwen 4B.
- Import audio, video, and PDF files.
- Save video links.
- Use a light or dark theme.

## Requirements

- macOS with Apple Silicon. Other systems are not verified.
- Node.js 22.13.0 or later.
- Git and Homebrew.
- About 3 GB of disk space for model files.
- More disk space for recordings and software packages.

An internet connection is necessary for installation and model downloads.
After setup, the models run on your computer.

## Install

1. Get the source files.

   ```sh
   git clone https://github.com/khantthuaung/PaRaPipe.git
   cd PaRaPipe
   ```

2. Install the required tools and packages.

   ```sh
   brew install whisper-cpp ffmpeg llama.cpp
   npm ci
   ```

3. Download and configure the models.

   ```sh
   npm run transcription:setup
   npm run notes:setup
   ```

   These commands create a private local configuration file.
   Do not add that file to Git.

4. Start the app.

   ```sh
   npm run dev
   ```

5. Open [localhost:3000](http://localhost:3000/) in your browser.

To stop the app, press **Ctrl+C** in the terminal.

## Use

1. Create a subject.
2. Select the subject before recording.
3. Start the recording and permit microphone access.
4. Type personal notes if necessary.
5. Select **Finish & save**.
6. Wait for the transcript and study notes.

Keep the browser tab open until the recording is saved.
The app does not save audio continuously.
Check important study notes against the transcript.

## Data and limits

The app uses local Cloudflare D1 and R2 development storage.
Recordings and model files stay outside Git.
Keep the app on localhost. Do not expose it to the internet.

- File imports must be 100 MB or smaller.
- Transcription accepts recordings up to 100 MB and four hours.
- Transcription starts after saving. Live captions are not available.
- The app stores PDFs. It does not extract their text.
- Video links are bookmarks. The app does not transcribe them.
- The library loads the latest 100 lectures and materials.

## Tests

Run the build and tests:

```sh
npm test
```

## License

The application uses the [MIT license](LICENSE).
Fonts and models have separate licenses.
