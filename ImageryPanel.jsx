import React, { useEffect, useRef, useState } from "react";

const MAX_BYTES = 5 * 1024 * 1024;

export default function ImageryPanel({
  assessment,
  included,
  onAssessmentChange,
  onToggleInclude,
  planBusy,
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [previewFailed, setPreviewFailed] = useState(false);
  const input = useRef(null);
  const request = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => () => request.current?.abort(), []);

  function stopRequest() {
    request.current?.abort();
    request.current = null;
    setLoading(false);
  }
  function chooseFile(event) {
    const chosen = event.target.files?.[0];
    event.target.value = "";
    if (!chosen) return;
    if (!["image/jpeg", "image/png"].includes(chosen.type)) {
      setError("Please choose a JPEG or PNG image.");
      return;
    }
    if (chosen.size === 0 || chosen.size > MAX_BYTES) {
      setError("Please choose a nonempty image no larger than 5 MB.");
      return;
    }
    stopRequest();
    setFile(chosen);
    setError("");
    setPreviewFailed(false);
    onAssessmentChange(null);
  }
  function removeImage() {
    stopRequest();
    setFile(null);
    setError("");
    setPreviewFailed(false);
    onAssessmentChange(null);
  }
  async function analyze() {
    if (!file) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    onAssessmentChange(null);
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      // Raw file bytes go to Python; credentials never enter React.
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
        signal: controller.signal,
      });
      const result = await response.json().catch(() => { throw new Error("Image analysis is unavailable. Please try again."); });
      if (!response.ok)
        throw new Error(
          typeof result.detail === "string"
            ? result.detail
            : "Image analysis is unavailable. Please try again.",
        );
      if (request.current === controller) onAssessmentChange(result);
    } catch (failure) {
      if (request.current === controller)
        setError(
          failure.name === "AbortError"
            ? "Image analysis took too long. Please try again."
            : failure.message === "Failed to fetch"
              ? "Cannot reach image analysis. Check that Python is running, then try again."
              : failure.message,
        );
    } finally {
      clearTimeout(timer);
      if (request.current === controller) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <section className="imagery-panel" aria-label="Aerial and drone imagery">
      <div className="section-heading">
        <h2>AERIAL / DRONE IMAGERY</h2>
        <button
          className="secondary"
          type="button"
          onClick={() => input.current.click()}
        >
          UPLOAD IMAGE
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        onChange={chooseFile}
        className="image-file-input"
        aria-label="Upload disaster image"
      />
      <p className="muted">
        Upload aerial disaster imagery (JPEG or PNG, up to 5 MB / 16
        megapixels). Analysis sends the image to OpenAI through Python.
      </p>
      <p className="map-disclaimer">Simulated</p>
      {file && (
        <div className="imagery-upload">
          <div>
            {preview && (
              <img
                className="imagery-preview"
                src={preview}
                alt={`Uploaded simulation image: ${file.name}`}
                onError={() => {
                  setPreviewFailed(true);
                  setError(
                    "This image preview could not be read. Please choose a valid JPEG or PNG.",
                  );
                }}
              />
            )}
          </div>
          <div>
            <p className="imagery-filename">{file.name}</p>
            <div className="imagery-actions">
              <button className="secondary" type="button" onClick={removeImage}>
                REMOVE IMAGE
              </button>
              <button
                className="secondary"
                type="button"
                disabled={loading || previewFailed}
                onClick={analyze}
              >
                {loading ? "ANALYZING IMAGE…" : "ANALYZE IMAGE WITH AI"}
              </button>
            </div>
            <p className="muted">
              Images are processed in memory and are not saved by SkyRescue.
            </p>
          </div>
        </div>
      )}
      <div aria-live="polite" aria-busy={loading}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {assessment && (
          <div className="image-assessment">
            <h3>AI IMAGE ASSESSMENT</h3>
            <p className="assessment-label">
              AI-generated observations — may be inaccurate. Incident data
              remains authoritative.
            </p>
            <div className="assessment-columns">
              <div>
                <h4>Visible observations</h4>
                {assessment.observations.length ? (
                  <ul>
                    {assessment.observations.map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No clear observations reported.</p>
                )}
              </div>
              <div>
                <h4>Possible concerns (inferences)</h4>
                {assessment.possible_concerns.length ? (
                  <ul>
                    {assessment.possible_concerns.map((text, index) => (
                      <li key={index}>{text}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No additional concerns reported.</p>
                )}
              </div>
            </div>
            <p>{assessment.summary}</p>
            <p className="muted">
              Visual confidence: {assessment.confidence} (qualitative, not a
              probability)
            </p>
            <button
              className="secondary"
              type="button"
              disabled={planBusy}
              aria-pressed={included}
              onClick={onToggleInclude}
            >
              {included
                ? "ASSESSMENT INCLUDED — REMOVE FROM PLAN"
                : "INCLUDE ASSESSMENT IN RESPONSE PLAN"}
            </button>
            {included && (
              <p className="assessment-label">
                Included as supplementary context in the next rescue-priority
                request. Original incident data takes precedence.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

