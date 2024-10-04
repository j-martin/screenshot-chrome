// Copyright (c) 2012,2013 Peter Coles - http://mrcoles.com/ - All rights reserved.
// Copyright (c) 2015,2018 Jean-Martin Archer
// Use of this source code is governed by the MIT License found in LICENSE

const capturePage = cfg => {
  const createHiDPICanvas = cfg => {
    const canvas = document.createElement("canvas");
    const w = cfg.totalWidth + cfg.margins.left + cfg.margins.right;
    const h =
      cfg.totalHeight +
      cfg.margins.top +
      cfg.margins.bottom +
      cfg.titleBar.height;
    canvas.width = w * cfg.pixelRatio;
    canvas.height = h * cfg.pixelRatio;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    canvas
      .getContext("2d")
      .setTransform(cfg.pixelRatio, 0, 0, cfg.pixelRatio, 0, 0);
    return canvas;
  };

  const generateScreenshot = (dataURI, titleBarData) => {
    const canvas = createHiDPICanvas(cfg);
    const ctx = canvas.getContext("2d");

    const image = new Image();
    const titleBarImage = new Image();
    titleBarImage.onload = () => {
      addTitleBar(ctx, titleBarImage, cfg);
    };
    titleBarImage.src = titleBarData;
    image.onload = () => {
      const coords = {
        x: cfg.margins.left,
        y: cfg.margins.top + cfg.titleBar.height,
        w: cfg.totalWidth,
        h: cfg.totalHeight
      };
      ctx.drawImage(image, coords.x, coords.y, coords.w, coords.h);
      showScreenshot(canvas, cfg);
    };
    image.src = dataURI;
  }

  chrome.tabs.captureVisibleTab(
    null,
    { format: "png", quality: 100 },
    dataURI => {
      if (dataURI) {
        document.body.innerText = "";
        generateScreenshot(dataURI, cfg.titleBar.data)
        generateScreenshot(dataURI, cfg.titleBar.dataDark)
      }
    }
  );

  const addTitleBar = (ctx, titleBarImage, cfg) => {
    const leftWidth = cfg.titleBar.leftWidth;
    const rightDx = cfg.margins.left + cfg.totalWidth - cfg.titleBar.rightWidth;
    const offset = cfg.titleBar.offset;

    const middleBar = {
      sx: offset,
      sy: 0,
      sw: 5,
      sh: leftWidth * 2,
      dx: cfg.margins.left + 5,
      dy: cfg.margins.top,
      dw: rightDx - cfg.margins.left,
      dh: leftWidth
    };
    const leftBar = {
      sx: 0,
      sy: 0,
      sw: offset * 2,
      sh: leftWidth * 2,
      dx: cfg.margins.left,
      dy: cfg.margins.top,
      dw: offset,
      dh: leftWidth
    };
    const rightBar = {
      sx: offset,
      sy: 0,
      sw: offset * 2,
      sh: leftWidth * 2,
      dx: rightDx,
      dy: cfg.margins.top,
      dw: offset,
      dh: leftWidth
    };

    addShadow(ctx, cfg);
    drawBar(ctx, titleBarImage, middleBar);
    drawBar(ctx, titleBarImage, leftBar);
    drawBar(ctx, titleBarImage, rightBar);
  };

  const drawBar = (ctx, image, coords) => {
    ctx.drawImage(
      image,
      coords.sx,
      coords.sy,
      coords.sw,
      coords.sh,
      coords.dx,
      coords.dy,
      coords.dw,
      coords.dh
    );
  };

  const addShadow = (ctx, cfg) => {
    ctx.save();
    const rect = {
      x: cfg.margins.left + cfg.shadow.edgeOffset,
      y: cfg.margins.top + cfg.shadow.edgeOffset,
      w: cfg.totalWidth - cfg.shadow.edgeOffset * 2,
      h: cfg.totalHeight + cfg.titleBar.height - cfg.shadow.edgeOffset
    };
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.shadowColor = cfg.shadow.color;
    ctx.shadowBlur = cfg.shadow.blur;
    ctx.shadowOffsetX = cfg.shadow.offsetX;
    ctx.shadowOffsetY = cfg.shadow.offsetY;
    ctx.fill();
    ctx.restore();
  };
};

const showScreenshot = (canvas, cfg) => {
  const link = document.createElement("a");
  link.download = cfg.filename;
  let dataURL = canvas.toDataURL("image/png");
  link.href = dataURL.replace("image/png", "image/octet-stream");
  const image = document.createElement("img");
  image.setAttribute("src", dataURL);
  image.setAttribute("width", 400);
  image.setAttribute("title", "Click to download");
  link.appendChild(image);
  document.body.appendChild(link);
  clearTimeout(cfg.errorTimeout);
  chrome.tabs.setZoom(cfg.tab.id, cfg.originalZoom);
};

const generateFilename = url => {
  let name = url.split("?")[0].split("#")[0];
  if (name) {
    name = name
      .replace(/^https?:\/\//, "")
      .replace(/[^A-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[_\-]+/, "")
      .replace(/[_\-]+$/, "")
      .slice(0, 64);
    name = "-" + name;
  } else {
    name = "";
  }
  name = "screenshot" + name + "-" + Date.now() + ".png";
  return name;
};

const getPixelRatio = () => {
  const ctx = document.createElement("canvas").getContext("2d"),
    dpr = window.devicePixelRatio || 1,
    bsr = ctx.webkitBackingStorePixelRatio || ctx.backingStorePixelRatio || 1;
  return dpr / bsr;
};

const main = () => {
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, tabs => {
    const tab = tabs[0];

    if (tab.url.indexOf("chrome.google.com") > 0) {
      document.body.innerText =
        "Unfortunately, due to a restrictions with Google Chrome, " +
        "it is not possible to capture a screenshot of: " +
        "chrome.google.com." +
        "\n\nOther websites should work fine.";
      return;
    }

    const prepareCapture = originalZoom => {
      let errorTimeout = setTimeout(
        () => (document.body.innerText = "Failed to capture the screenshot."),
        10000
      );
      const PIXEL_RATIO = getPixelRatio();
      const cfg = {
        tab,
        errorTimeout,
        url: tab.url,
        filename: generateFilename(tab.url),
        targetWidth: 1366,
        targetHeight: null,
        totalWidth: null,
        totalHeight: null,
        pixelRatio: PIXEL_RATIO,
        originalWidth: tab.width,
        originalZoom,
        margins: {
          top: 40,
          bottom: 100,
          left: 70,
          right: 70
        },
        titleBar: {
          height: 36,
          leftWidth: 120,
          rightWidth: 18,
          offset: 130,
          data:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKYAAABIBAMAAACO6JO2AAAAMFBMVEUAAADi4uLi4uLi4uLi4uLi4uLi4uLi4uLi4uK7u7u+vr7d3d3R0dHV1dXJycnGxsaIaBZ/AAAACHRSTlMAmVXeBuQD1x8rCiYAAAEKSURBVFjD7ZY9CsJAEIUH8QQWYqnYWFtZ2ngDL+BRFISFiP3GvzqCtfEGWlnrCfQIgoVGjCvMyDQPEZlXfjw+yGYzEyIq1loOlXWpTVnqDplmpuw5bMpEVAE7+0QFh06VOnBnlxpw5yAcJ/BAW3DnkBw+5jSnOc35685onyyvqYhkpjujs79nnkpIZrrz6B9ZSUhkunPkn9nKiDPdecjLMxFxpjujJC/HqYg4U51j/8pJRJypzk0oT0TEmerchfJURJypzksoL0TEmepMQjkWEWeq079FRJx91Yl/dvw7wt8l/J3Hf5v4GYKfdfiZjN8d+B2n7+L4moqIsz/7DzGnOc1pTnOa05yfcwPXnJ+jWkDKqgAAAABJRU5ErkJggg==",
          dataDark:
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKYAAABICAMAAABLGH63AAAAP1BMVEVHcEwqKioqKioAAAArKysqKioqKiopKSkzMzMrKytkZGQqKioxMTFQUFBhYWFFRUU8PDxUVFReXl5jY2NDQ0MwiPaiAAAACnRSTlMA+aUC3FXgUQWKYtOSQwAAARlJREFUaN7t2NsKwjAQhOFp7TFJz77/s3ojRWwudrcgWZm5/gkfiDUVAIChrbsqFreqq9sB5/omFrumfyMfYyx64wMAULgyxhEA+lj8emBoymc2A9roYC1qD8wanQdmh8oDs0J0MTLJJJNMMskkk8yCmGnZ9uPYtyXdr+SdkpmmcG5K9yp5p2Wuc/jYvN6p5J2W+Qxfe9oreadlruGy1VrJOy0zzdeD52Sr5J2aOYXMJlsl77TMFLJLlkreqZlL/uDFUsk7NXPLH7xZKnmnZu75g3dLJe/UzCN/8GGp5N2/Mp186E6+Qk4eSE4e705+LL1cPZxc5Lxci728ZHh5ZfPyAsx/Pcgkk0wyySSTTDLJJJNMMskk85d7AdA6/sDgopk5AAAAAElFTkSuQmCC"
        },
        shadow: {
          color: "rgba(0, 0, 0, 0.5)",
          blur: 50 * PIXEL_RATIO,
          offsetX: 0,
          offsetY: 20 * PIXEL_RATIO,
          edgeOffset: 3 // shrinks the box generating the shadow so it doesn't show in the rounded the titleBar corners
        }
      };

      chrome.tabs.setZoom(tab.id, 1.0, () => {
        setTimeout(
          () =>
            chrome.tabs.get(tab.id, tab => {
              cfg.totalWidth = tab.width;
              cfg.totalHeight = tab.height;
              capturePage(cfg);
            }),
          50
        );
      });
    };

    chrome.tabs.getZoom(tab.id, prepareCapture);
  });
};

main();
