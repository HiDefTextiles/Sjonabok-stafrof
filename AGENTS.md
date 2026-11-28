# Stafróf repository

- Before regenerating the TXT gallery, update the `sjonabok` submodule to the latest commit on its `main` branch and commit the pin.
- Build the shared gallery with `python sjonabok/dataset-gallery/build.py . gallery/motifs --project stafrof --repository https://github.com/HiDefTextiles/Sjonabok-stafrof` and commit the output.
- Gallery-only changes do not need a release. Before tagging a data or font release, ask the maintainer whether it is a minor or major update and wait for the answer.
