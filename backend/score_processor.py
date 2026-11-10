import subprocess
from itertools import combinations
from pathlib import Path
from music21 import converter, note, chord, stream

AUDIVERIS = "/opt/audiveris/bin/Audiveris"

class NoMusicXML(RuntimeError):
    pass

def has_overlapping_voices(events):
    sounding = [
        event for event in events
        if event["type"] != "rest" and "voice" in event and event["duration"] > 0
    ]
    return any(
        first["voice"] != second["voice"]
        and first["offset"] < second["offset"] + second["duration"]
        and second["offset"] < first["offset"] + first["duration"]
        for first, second in combinations(sounding, 2)
    )

def process_score(pdf_path, output_dir):
    pdf_path = Path(pdf_path).resolve()
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    # Convert PDF to MusicXML
    result = subprocess.run(
        [
            AUDIVERIS,
            "-batch",
            "-export",
            "-output",
            str(output_dir),
            "--",
            str(pdf_path)
        ],
        capture_output=True,
        text=True,
        timeout=180
    )

    if result.returncode != 0:
        raise RuntimeError(f"Audiveris failed:\n{result.stdout}\n{result.stderr}")

    # Find the generated MusicXML files
    mxl_files = sorted(output_dir.rglob("*.mxl"))

    if not mxl_files:
        raise NoMusicXML("No MusicXML files were generated.")

    movements = []

    for mxl_file in mxl_files:
        score = converter.parse(str(mxl_file))
        measures = []

        for part in score.parts:
            for measure in part.getElementsByClass("Measure"):
                events = []

                for element in measure.recurse().notesAndRests:
                    if isinstance(element, note.Note):
                        event = {"type": "note", "pitch": element.pitch.nameWithOctave}
                    elif isinstance(element, chord.Chord):
                        event = {"type": "chord", "pitches": [p.nameWithOctave for p in element.pitches]}
                    elif isinstance(element, note.Rest):
                        event = {"type": "rest"}
                    else:
                        continue
                    event["duration"] = float(element.duration.quarterLength)
                    event["offset"] = float(element.getOffsetInHierarchy(measure))
                    voice = element.getContextByClass(stream.Voice)
                    if voice is not None:
                        event["voice"] = str(voice.id)
                    events.append(event)

                measures.append({
                    "number": measure.number,
                    "events": events,
                    "overlapping_voices": has_overlapping_voices(events),
                })

        movements.append({
            "file": mxl_file.name,
            "measures": measures
        })

    return movements
