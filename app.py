import streamlit as st
import streamlit.components.v1 as components

from bundle_editor import build_editor

st.set_page_config(page_title="Pop Logo Studio", page_icon="✦", layout="wide")
st.caption("Chrome / Edge 推奨 · PC内のフォントの取得にはブラウザの許可が必要です。編集データはJSONで保存してください。")
components.html(build_editor(), height=1200, scrolling=True)
