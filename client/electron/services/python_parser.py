#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BiBooks 增强 PDF 解析脚本
支持：opendataloader-pdf（本地模式）、MinerU（pipeline 模式）、PaddleOCR（本地 OCR）
调用方式：python python_parser.py <provider> <input_path> [output_dir]
退出码：0=成功，1=失败
输出：stdout=markdown内容，stderr=错误信息
"""

import sys
import os
import json
import tempfile
import shutil
import subprocess
from pathlib import Path


def parse_with_opendataloader(input_path: str) -> str:
    import opendataloader_pdf
    with tempfile.TemporaryDirectory() as tmp_dir:
        opendataloader_pdf.convert(
            input_path=[input_path],
            output_dir=tmp_dir,
            format="markdown",
        )
        # 查找输出的 .md 文件
        for root, _dirs, files in os.walk(tmp_dir):
            for fname in files:
                if fname.endswith(".md"):
                    with open(os.path.join(root, fname), encoding="utf-8") as f:
                        return f.read()
    return ""


def parse_with_mineru(input_path: str) -> str:
    with tempfile.TemporaryDirectory() as tmp_dir:
        proc = subprocess.run(
            [
                sys.executable,
                "-m",
                "mineru.cli.client",
                "-p",
                input_path,
                "-o",
                tmp_dir,
                "-b",
                "pipeline",
                "-m",
                "auto",
                "-l",
                "ch",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=600,
        )
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "").strip()
            raise RuntimeError(detail or f"MinerU CLI 退出码 {proc.returncode}")

        # 查找输出的 .md 文件
        for root, _dirs, files in os.walk(tmp_dir):
            for fname in files:
                if fname.endswith(".md"):
                    with open(os.path.join(root, fname), encoding="utf-8") as f:
                        return f.read()
    return ""


def parse_with_paddleocr(input_path: str) -> str:
    try:
        from paddleocr import PaddleOCR
    except ImportError as exc:
        raise ImportError("paddleocr 未安装，请先安装本地 OCR 依赖") from exc

    suffix = Path(input_path).suffix.lower()
    if suffix == ".pdf":
        try:
            from pdf2image import convert_from_path
        except ImportError as exc:
            raise ImportError("pdf2image 未安装，无法对扫描 PDF 执行 PaddleOCR") from exc

        with tempfile.TemporaryDirectory() as tmp_dir:
            pages = convert_from_path(input_path, dpi=200)
            parts = ["# OCR 识别结果", ""]
            for index, page in enumerate(pages, start=1):
                page_path = os.path.join(tmp_dir, f"page-{index}.png")
                page.save(page_path, "PNG")
                parts.append(f"## 第 {index} 页")
                parts.append("")
                parts.append(_paddleocr_image_to_markdown(page_path))
                parts.append("")
            return "\n".join(parts).strip()

    return _paddleocr_image_to_markdown(input_path)


def _paddleocr_image_to_markdown(image_path: str) -> str:
    ocr = PaddleOCR(use_angle_cls=True, lang="ch", show_log=False)
    result = ocr.ocr(image_path, cls=True)
    lines = []
    for page in result or []:
        for item in page or []:
            if not item or len(item) < 2:
                continue
            text_info = item[1]
            if isinstance(text_info, (list, tuple)) and text_info:
                text = str(text_info[0]).strip()
                if text:
                    lines.append(text)
    return "\n".join(lines)


def main():
    if len(sys.argv) < 3:
        print("用法: python python_parser.py <provider> <input_path>", file=sys.stderr)
        sys.exit(1)

    provider = sys.argv[1]
    input_path = sys.argv[2]

    if not os.path.exists(input_path):
        print(f"文件不存在: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        if provider == "opendataloader":
            result = parse_with_opendataloader(input_path)
        elif provider == "mineru-local":
            result = parse_with_mineru(input_path)
        elif provider == "paddleocr-local":
            result = parse_with_paddleocr(input_path)
        else:
            print(f"未知解析器: {provider}", file=sys.stderr)
            sys.exit(1)

        sys.stdout.write(result)
        sys.exit(0)
    except ImportError as e:
        print(f"依赖未安装: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"解析失败: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
