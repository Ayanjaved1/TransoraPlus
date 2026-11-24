# TransoraPlus

TransoraPlus is a visual coding studio for Deaf and hard-of-hearing learners. A learner can open an exercise, write code and follow an instructor’s signed explanation alongside the editor. Keeping the recording beside the exercise lets the learner move between an explanation and the code it describes.

## Inside the signed tutoring experiment

Imagine a learner pausing a Python loop and signing “Why does this stop at four?” Transora’s research goal is to answer that question in sign language beside the code. The first experiment tests the movement and translation pipeline behind that interaction.

| First Indian Sign Language pilot | Result |
| --- | --- |
| Training data | Two iSign clips from source `1782bea75c7d` |
| Validation data | Two clips from a separate source, `ee235596b76f` |
| Run | One epoch; reported validation loss **3.6103** |
| Checkpoint | The training task reloaded the 4.6 MiB checkpoint successfully |

The pilot establishes that training and checkpoint loading work on this small sample. Translation quality, live conversation, and the intelligibility of generated signing still need evaluation with Deaf learners and fluent signers.

[Explore the model and training guide](signed-ai/) · [View the PyTorch architecture](signed-ai/model.py) · [Explore the iSign research dataset](https://huggingface.co/datasets/Exploration-Lab/iSign)

To repeat the pilot with authorized copies of the four clips, supply a CSV containing `language,split,source_video_id,video,text` and run the following from `signed-ai` after installing its requirements:

```sh
python train.py corpus.csv ISL --split-by source_video_id --epochs 1
```

## Try a lesson

1. Start the app locally using the instructions below and create a demo account.
2. Choose a course card and open one of the ten introductory exercises.
3. Try an HTML or JavaScript challenge in the browser. Save a draft, return to the lesson and check your progress.
4. To try the interpreter panel, attach a local signed recording. You can also supply a three-cue WebVTT caption file.

## How it works

| Component | Role |
| --- | --- |
| Python and SQLite | Serve the landing page and studio, manage sessions and persist learner progress and discussions. |
| Browser editor | Runs HTML and JavaScript locally. Python exercises load Pyodide. |
| Learning guide | Provides authored hints by default. An optional server-side AI integration answers questions using lesson context and relevant editor text. |
| Starter lessons | React, database and technical ASL exercises use short-answer checks. |

## Run locally

Install Python 3.10 or later. If you downloaded the ZIP, extract it first. Run the launcher from the directory containing `server.py`.

| Platform | Start the studio |
| --- | --- |
| Windows | Double-click `Start-Transora.cmd` and keep the terminal open. |
| macOS or Linux | Run `python3 server.py --open`. |

Open `http://127.0.0.1:8000`. Set `PORT` to choose another port. Keep this demo on the loopback interface. The backend stores account and learning data in `studio.sqlite3`, hashes passwords with scrypt and uses an HTTP-only session cookie.

## Optional features

- **Java exercises** require a running Docker engine and the image downloaded with `docker pull eclipse-temurin:21-jdk`.
- **AI answers** require `OPENAI_API_KEY` in the server environment. Set `OPENAI_MODEL` to override the default `gpt-4o-mini`. Submitted questions, lesson context and relevant editor text go to the provider.
- **Network access** is used for Pyodide, syntax tools and the Three.js scene. The homepage includes an offline CSS 3D fallback.

The working demo includes ten exercises. The wider catalogue, testimonials and institutional references on the landing page are prototype content. Paid subscriptions, certificates and live study rooms are outside this release.
