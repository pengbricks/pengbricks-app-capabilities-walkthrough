"""MLflow pyfunc wrapper for a pickled scikit-learn model (Models from Code).

MLflow logs this file as is. The pickle travels as an artifact, so the class itself is never pickled.
"""

import pickle

import mlflow
import pandas as pd


class PickledModel(mlflow.pyfunc.PythonModel):
    def load_context(self, context):
        with open(context.artifacts["model_pickle"], "rb") as handle:
            self.model = pickle.load(handle)

    def predict(self, context, model_input: pd.DataFrame, params=None):
        return self.model.predict_proba(model_input)[:, 1]


mlflow.models.set_model(PickledModel())
