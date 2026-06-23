import os
import pandas as pd
import numpy as np
import plotly.graph_objects as go

class GBMForecaster:
    def __init__(self, file_path, split_ratio=0.8, window=30, n_sims=5000, n_future=15, scenario="mean"):
        self.file_path = file_path
        self.split_ratio = split_ratio
        self.window = window
        self.n_sims = n_sims
        self.n_future = n_future
        self.scenario = scenario
        self.dt = 1
        
        self.df = None
        self.price = None
        self.history_price = None
        self.oos_price = None          
        self.history_dates = None
        self.oos_dates = None
        
        self.oos_rmse = None
        self.oos_mape = None
        
        self.oos_medians = None
        self.oos_lower = None
        self.oos_upper = None
        
        # Track where each chunk starts to draw visual boundaries
        self.chunk_start_dates = []
        
        self.future_median = None
        self.future_lower = None
        self.future_upper = None
        self.future_dates = None
        self.prob_up = None
        
        # New attributes to store boundary ranges at day 15
        self.future_day15_min = None
        self.future_day15_max = None
        
    def _load_data(self):
        self.df = pd.read_csv(self.file_path)
        self.df.columns = [str(c).strip() for c in self.df.columns]
        self.df["Date"] = pd.to_datetime(self.df["Date"])
        self.df["Close"] = pd.to_numeric(self.df["Close"], errors="coerce")
        self.df = self.df.dropna(subset=["Close"]).sort_values("Date").reset_index(drop=True)
        self.price = self.df["Close"].values
        
    def _split_data(self):
        split_idx = int(len(self.price) * self.split_ratio)
        self.history_price = self.price[:split_idx]
        self.oos_price = self.price[split_idx:]
        self.history_dates = self.df['Date'][:split_idx]
        self.oos_dates = self.df['Date'][split_idx:]
        
    @staticmethod
    def _estimate_params(prices):
        log_ret = np.diff(np.log(prices))
        mu = np.mean(log_ret)
        sigma = np.std(log_ret, ddof=1)
        return mu, sigma
    
    def _out_of_sample_evaluation(self):
        n_oos = len(self.oos_price)
        
        oos_medians = np.full(n_oos, np.nan)
        oos_lowers = np.full(n_oos, np.nan)
        oos_uppers = np.full(n_oos, np.nan)
        self.chunk_start_dates = []
        
        for i in range(0, n_oos, self.n_future):
            # Save the date where this testing patch begins
            self.chunk_start_dates.append(self.oos_dates.iloc[i])
            
            if i == 0:
                current_history = list(self.history_price[-self.window:])
            else:
                combined = np.concatenate([self.history_price, self.oos_price[:i]])
                current_history = list(combined[-self.window:])
                
            mu_win, sigma_win = self._estimate_params(np.array(current_history))
            last_price = current_history[-1]
            
            steps_to_forecast = min(self.n_future, n_oos - i)
            
            paths = np.zeros((self.n_sims, steps_to_forecast + 1))
            paths[:, 0] = last_price
            for t in range(1, steps_to_forecast + 1):
                Z = np.random.normal(0, 1, self.n_sims)
                paths[:, t] = paths[:, t-1] * np.exp(
                    (mu_win - 0.5 * sigma_win**2) * self.dt
                    + sigma_win * np.sqrt(self.dt) * Z
                )
            
            oos_medians[i:i+steps_to_forecast] = np.median(paths, axis=0)[1:]
            oos_lowers[i:i+steps_to_forecast] = np.percentile(paths, 2.5, axis=0)[1:]
            oos_uppers[i:i+steps_to_forecast] = np.percentile(paths, 97.5, axis=0)[1:]
            
        self.oos_medians = oos_medians
        self.oos_lower = oos_lowers
        self.oos_upper = oos_uppers
        
        self.oos_rmse = np.sqrt(np.nanmean((self.oos_medians - self.oos_price) ** 2))
        self.oos_mape = np.nanmean(np.abs((self.oos_price - self.oos_medians) / self.oos_price)) * 100
        
    def _future_forecast(self):
        final_window = list(self.price[-self.window:])
        mu_final, sigma_final = self._estimate_params(np.array(final_window))
        last_price = self.price[-1]

        if self.scenario == "conservative":
            sigma_final *= 0.8
        elif self.scenario == "aggressive":
            sigma_final *= 1.35

        paths = np.zeros((self.n_sims, self.n_future + 1))
        paths[:, 0] = last_price
        for t in range(1, self.n_future + 1):
            Z = np.random.normal(0, 1, self.n_sims)
            paths[:, t] = paths[:, t-1] * np.exp(
                (mu_final - 0.5 * sigma_final**2) * self.dt
                + sigma_final * np.sqrt(self.dt) * Z
            )

        self.future_median = np.median(paths, axis=0)[1:]
        self.future_lower = np.percentile(paths, 2.5, axis=0)[1:]
        self.future_upper = np.percentile(paths, 97.5, axis=0)[1:]

        # Capture the simulated lower and upper range specifically at Day 15
        self.future_day15_min = self.future_lower[-1]
        self.future_day15_max = self.future_upper[-1]
        self.prob_up = float(np.mean(paths[:, -1] > last_price) * 100)

        self.future_dates = pd.date_range(
            start=self.df['Date'].iloc[-1] + pd.Timedelta(days=1),
            periods=self.n_future,
            freq='B'
        )
        
    def _plot_results(self):
        fig = go.Figure()
        
        #fig.add_trace(go.Scatter(x=self.history_dates, y=self.history_price,
        #                         name='Historical Data', line=dict(color='blue', width=1.5)))
        
        fig.add_trace(go.Scatter(x=self.oos_dates, y=self.oos_price,
                                 name='Out-of-Sample Actual', line=dict(color='green', width=1.5)))
        
        fig.add_trace(go.Scatter(x=self.oos_dates, y=self.oos_medians,
                                 name='Out-of-Sample Forecast Chunks', line=dict(color='orange', width=1.5, dash='dash')))
        
        fig.add_trace(go.Scatter(x=pd.concat([self.oos_dates, self.oos_dates[::-1]]),
                                 y=np.concatenate([self.oos_upper, self.oos_lower[::-1]]),
                                 fill='toself', fillcolor='rgba(255, 165, 0, 0.12)',
                                 line=dict(color='rgba(255,165,0,0)'),
                                 hoverinfo="skip", showlegend=True, name='Out-of-Sample 95% PI'))
        
        fig.add_trace(go.Scatter(x=self.future_dates, y=self.future_median,
                                 name='Future Forecast (Median)', line=dict(color='red', width=1.5), mode='lines'))
        
        fig.add_trace(go.Scatter(x=pd.concat([pd.Series(self.future_dates), pd.Series(self.future_dates)[::-1]]),
                                 y=np.concatenate([self.future_upper, self.future_lower[::-1]]),
                                 fill='toself', fillcolor='rgba(255, 0, 0, 0.18)',
                                 line=dict(color='rgba(255,0,0,0)'),
                                 hoverinfo="skip", showlegend=True, name='Future 95% PI'))
        
        # Dynamically add separation lines for each evaluation patch
        for date in self.chunk_start_dates:
            fig.add_vline(x=date.timestamp() * 1000, line_width=1, line_dash="dot", line_color="rgba(128, 128, 128, 0.6)")
            
        # Add a clear line separating historical data from the live future forecast
        if len(self.future_dates) > 0:
            fig.add_vline(x=self.df['Date'].iloc[-1].timestamp() * 1000, line_width=1.5, line_dash="solid", line_color="black")
        
        stock_title = os.path.basename(self.file_path).replace(".csv", "").replace("_", " ")
        fig.update_layout(
            title=f'Interactive GBM Forecast (15-Day Chunk Backtest) - {stock_title}',
            xaxis_title='Date',
            yaxis_title='Price (EGP)',
            hovermode='x unified',
            template='plotly_white',
            legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01)
        )
        return fig
        
    def run(self):
        self._load_data()
        self._split_data()
        self._out_of_sample_evaluation()   
        self._future_forecast()
        fig = self._plot_results()
        
        metrics_text = (
            f"### Out-of-Sample Performance (Tested in 15-day blocks)\n"
            f"- **RMSE:** {self.oos_rmse:.2f}\n"
            f"- **MAPE:** {self.oos_mape:.1f}%\n"
            f"- **Realistic Horizon Accuracy:** {100 - self.oos_mape:.1f}%\n\n"
            f"### Expected Boundaries at Day {self.n_future} of Future Horizon\n"
            f"- **95% PI Minimum Bound:** {self.future_day15_min:.2f} EGP\n"
            f"- **95% PI Maximum Bound:** {self.future_day15_max:.2f} EGP\n"
        )
        return fig, metrics_text